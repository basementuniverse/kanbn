const fs = require("fs");
const path = require("path");
const glob = require("glob-promise");
const parseIndex = require("./parse-index");
const parseTask = require("./parse-task");
const utility = require("./utility");
const yaml = require("yamljs");
const humanizeDuration = require("humanize-duration");
const rimraf = require("rimraf");

const DEFAULT_FOLDER_NAME = ".kanbn";
const DEFAULT_INDEX_FILE_NAME = "index.md";
const DEFAULT_TASKS_FOLDER_NAME = "tasks";
const DEFAULT_ARCHIVE_FOLDER_NAME = "archive";

// Date normalisation intervals measured in milliseconds
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Default fallback values for index options
const DEFAULT_TASK_WORKLOAD = 2;
const DEFAULT_TASK_WORKLOAD_TAGS = {
  Nothing: 0,
  Tiny: 1,
  Small: 2,
  Medium: 3,
  Large: 5,
  Huge: 8,
};
const DEFAULT_DATE_FORMAT = "d mmm yy, H:MM";
const DEFAULT_TASK_TEMPLATE = "^+^_${overdue ? '^R' : ''}${name}^: ${created ? ('\\n^-^/' + created) : ''}";

/**
 * Default options for the initialise command
 */
const defaultInitialiseOptions = {
  name: "Project Name",
  description: "",
  options: {
    startedColumns: ["In Progress"],
    completedColumns: ["Done"],
  },
  columns: ["Backlog", "Todo", "In Progress", "Done"],
};

/**
 * Check if a file or folder exists
 * @param {string} path
 * @return {Promise<boolean>} True if the file or folder exists
 */
async function exists(path) {
  try {
    await fs.promises.access(path, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    return false;
  }
  return true;
}

/**
 * Get a list of all tracked task ids
 * @param {object} index The index object
 * @param {?string} [columnName=null] The optional column name to filter tasks by
 * @return {Set} A set of task ids appearing in the index
 */
function getTrackedTaskIds(index, columnName = null) {
  return new Set(
    columnName
      ? index.columns[columnName]
      : Object.keys(index.columns)
          .map((columnName) => index.columns[columnName])
          .flat()
  );
}

/**
   * Get a task path from the id
   * @param {string} tasksPath The path to the tasks folder
   * @param {string} taskId The task id
   * @return {string} The task path
   */
function getTaskPath(tasksPath, taskId) {
  return path.join(tasksPath, addFileExtension(taskId));
}

/**
 * Add the file extension to an id if it doesn't already have one
 * @param {string} taskId The task id
 * @return {string} The task id with .md extension
 */
function addFileExtension(taskId) {
  if (!/\.md$/.test(taskId)) {
    return `${taskId}.md`;
  }
  return taskId;
}

/**
 * Remove the file extension from an id if it has one
 * @param {string} taskId The task id
 * @return {string} The task id without .md extension
 */
function removeFileExtension(taskId) {
  if (/\.md$/.test(taskId)) {
    return taskId.slice(0, taskId.length - ".md".length);
  }
  return taskId;
}


/**
 * Check if a task exists in the index
 * @param {object} index The index object
 * @param {string} taskId The task id to search for
 * @return {boolean} True if the task exists in the index
 */
function taskInIndex(index, taskId) {
  for (let columnName in index.columns) {
    if (index.columns[columnName].indexOf(taskId) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * Find a task in the index and returns the column that it's in
 * @param {object} index The index data
 * @param {string} taskId The task id to search for
 * @return {?string} The column name for the specified task, or null if it wasn't found
 */
function findTaskColumn(index, taskId) {
  for (let columnName in index.columns) {
    if (index.columns[columnName].indexOf(taskId) !== -1) {
      return columnName;
    }
  }
  return null;
}

/**
 * Add a task id to the specified column in the index
 * @param {object} index The index object
 * @param {string} taskId The task id to add
 * @param {string} columnName The column to add the task to
 * @param {?number} [position=null] The position in the column to move the task to, or last position if null
 * @return {object} The modified index object
 */
function addTaskToIndex(index, taskId, columnName, position = null) {
  if (position === null) {
    index.columns[columnName].push(taskId);
  } else {
    index.columns[columnName].splice(position, 0, taskId);
  }
  return index;
}

/**
 * Remove all instances of a task id from the index
 * @param {object} index The index object
 * @param {string} taskId The task id to remove
 * @return {object} The modified index object
 */
function removeTaskFromIndex(index, taskId) {
  for (let columnName in index.columns) {
    index.columns[columnName] = index.columns[columnName].filter((t) => t !== taskId);
  }
  return index;
}

/**
 * Rename all instances of a task id in the index
 * @param {object} index The index object
 * @param {string} taskId The task id to rename
 * @param {string} newTaskId The new task id
 * @return {object} The modified index object
 */
function renameTaskInIndex(index, taskId, newTaskId) {
  for (let columnName in index.columns) {
    index.columns[columnName] = index.columns[columnName].map((t) => (t === taskId ? newTaskId : t));
  }
  return index;
}

/**
 * Get a metadata property from a task, or undefined if the metadata property doesn't exist or
 * if the task has no metadata
 * @param {object} taskData The task object
 * @param {string} property The metadata property to check
 * @return {any} The metadata property value
 */
function getTaskMetadata(taskData, property) {
  if ("metadata" in taskData && property in taskData.metadata) {
    return taskData.metadata[property];
  }
  return undefined;
}

/**
 * Set a metadata value in a task. If the value is undefined, remove the metadata property instead
 * @param {object} taskData The task object
 * @param {string} property The metadata property to update
 * @param {string} value The value to set
 * @return {object} The modified task object
 */
function setTaskMetadata(taskData, property, value) {
  if (!("metadata" in taskData)) {
    taskData.metadata = {};
  }
  if (property in taskData.metadata && value === undefined) {
    delete taskData.metadata[property];
  } else {
    taskData.metadata[property] = value;
  }
  return taskData;
}

/**
 * Check if a task is completed
 * @param {object} index
 * @param {object} task
 * @return {boolean} True if the task is in a completed column or has a completed date
 */
function taskCompleted(index, task) {
  return (
    "completed" in task.metadata ||
    ("completedColumns" in index.options &&
      index.options.completedColumns.indexOf(findTaskColumn(index, task.id)) !== -1)
  );
}

/**
 * Sort a column in the index
 * @param {object} index The index object
 * @param {object[]} tasks The tasks in the index
 * @param {string} columnName The column to sort
 * @param {object[]} sorters A list of sorter objects
 * @return {object} The modified index object
 */
function sortColumnInIndex(index, tasks, columnName, sorters) {
  // Get a list of tasks in the target column and add computed fields
  tasks = tasks.map((task) => ({
    ...task,
    ...task.metadata,
    created: "created" in task.metadata ? task.metadata.created : "",
    updated: "updated" in task.metadata ? task.metadata.updated : "",
    started: "started" in task.metadata ? task.metadata.started : "",
    completed: "completed" in task.metadata ? task.metadata.completed : "",
    due: "due" in task.metadata ? task.metadata.due : "",
    assigned: "assigned" in task.metadata ? task.metadata.assigned : "",
    countSubTasks: task.subTasks.length,
    subTasks: task.subTasks.map((subTask) => `[${subTask.completed ? "x" : ""}] ${subTask.text}`).join("\n"),
    countTags: "tags" in task.metadata ? task.metadata.tags.length : 0,
    tags: "tags" in task.metadata ? task.metadata.tags.join("\n") : "",
    countRelations: task.relations.length,
    relations: task.relations.map((relation) => `${relation.type} ${relation.task}`).join("\n"),
    countComments: task.comments.length,
    comments: task.comments.map((comment) => `${comment.author} ${comment.text}`).join("\n"),
    workload: taskWorkload(index, task),
    progress: taskProgress(index, task),
  }));

  // Sort the list of tasks
  tasks = sortTasks(tasks, sorters);

  // Save the list of tasks back to the index
  index.columns[columnName] = tasks.map((task) => task.id);
  return index;
}

/**
 * Sort a list of tasks
 * @param {object[]} tasks
 * @param {object[]} sorters
 * @return {object[]} The sorted tasks
 */
function sortTasks(tasks, sorters) {
  tasks.sort((a, b) => {
    let compareA, compareB;
    for (let sorter of sorters) {
      compareA = a[sorter.field];
      compareB = b[sorter.field];
      if (sorter.filter) {
        compareA = sortFilter(compareA, sorter.filter);
        compareB = sortFilter(compareB, sorter.filter);
      }
      if (compareA === compareB) {
        continue;
      }
      return sorter.order === "descending" ? compareValues(compareB, compareA) : compareValues(compareA, compareB);
    }
    return 0;
  });
  return tasks;
}

/**
 * Transform a value using a sort filter regular expression
 * @param {string} value
 * @param {string} filter
 * @return {string} The transformed value
 */
function sortFilter(value, filter) {
  // Filter regex is global and case-insensitive
  const matches = [...value.matchAll(new RegExp(filter, "gi"))];
  const result = matches.map((match) => {
    // If the matched string has named capturing groups, concatenate their contents
    if (match.groups) {
      return Object.values(match.groups).join("");
    }

    // If the matched string has non-named capturing groups, use the contents of the first group
    if (match[1]) {
      return match[1];
    }

    // Otherwise use the matched string
    return match[0];
  });
  return result.join("");
}

/**
 * Compare two values (supports string, date and number values)
 * @param {any} a
 * @param {any} b
 * @return {number} A positive value if a > b, negative if a < b, otherwise 0
 */
function compareValues(a, b) {
  if (a === undefined && b === undefined) {
    return 0;
  }
  a = utility.coerceUndefined(a, typeof b);
  b = utility.coerceUndefined(b, typeof a);
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, undefined, { sensitivity: "accent" });
  }
  return a - b;
}

/**
 * Filter a list of tasks using a filters object containing field names and filter values
 * @param {object} index
 * @param {object[]}} tasks
 * @param {object} filters
 */
function filterTasks(index, tasks, filters) {
  return tasks.filter((task) => {
    // Get task id and column
    const taskId = utility.getTaskId(task.name);
    const column = findTaskColumn(index, taskId);

    // If no filters are defined, return all tasks
    if (Object.keys(filters).length === 0) {
      return true;
    }

    // Apply filters
    let result = true;

    // Id
    if ("id" in filters && !stringFilter(filters.id, task.id)) {
      result = false;
    }

    // Name
    if ("name" in filters && !stringFilter(filters.name, task.name)) {
      result = false;
    }

    // Description
    if ("description" in filters && !stringFilter(filters.description, task.description)) {
      result = false;
    }

    // Column
    if ("column" in filters && !stringFilter(filters.column, column)) {
      result = false;
    }

    // Created date
    if (
      "created" in filters &&
      (!("created" in task.metadata) || !dateFilter(filters.created, task.metadata.created))
    ) {
      result = false;
    }

    // Updated date
    if (
      "updated" in filters &&
      (!("updated" in task.metadata) || !dateFilter(filters.updated, task.metadata.updated))
    ) {
      result = false;
    }

    // Started date
    if (
      "started" in filters &&
      (!("started" in task.metadata) || !dateFilter(filters.started, task.metadata.started))
    ) {
      result = false;
    }

    // Completed date
    if (
      "completed" in filters &&
      (!("completed" in task.metadata) || !dateFilter(filters.completed, task.metadata.completed))
    ) {
      result = false;
    }

    // Due
    if ("due" in filters && (!("due" in task.metadata) || !dateFilter(filters.due, task.metadata.due))) {
      result = false;
    }

    // Workload
    if ("workload" in filters && !numberFilter(filters.workload, taskWorkload(index, task))) {
      result = false;
    }

    // Progress
    if ("progress" in filters && !numberFilter(filters.progress, taskProgress(index, task))) {
      result = false;
    }

    // Assigned
    if (
      "assigned" in filters &&
      !stringFilter(filters.assigned, "assigned" in task.metadata ? task.metadata.assigned : "")
    ) {
      result = false;
    }

    // Sub-tasks
    if (
      "sub-task" in filters &&
      !stringFilter(
        filters["sub-task"],
        task.subTasks.map((subTask) => `[${subTask.completed ? "x" : " "}] ${subTask.text}`).join("\n")
      )
    ) {
      result = false;
    }

    // Count sub-tasks
    if ("count-sub-tasks" in filters && !numberFilter(filters["count-sub-tasks"], task.subTasks.length)) {
      result = false;
    }

    // Tag
    if ("tag" in filters && !stringFilter(filters.tag, task.metadata.tags.join("\n"))) {
      result = false;
    }

    // Count tags
    if ("count-tags" in filters && !numberFilter(filters["count-tags"], task.tags.length)) {
      result = false;
    }

    // Relation
    if (
      "relation" in filters &&
      !stringFilter(
        filters.relation,
        task.relations.map((relation) => `${relation.type} ${relation.task}`).join("\n")
      )
    ) {
      result = false;
    }

    // Count relations
    if ("count-relations" in filters && !numberFilter(filters["count-relations"], task.relations.length)) {
      result = false;
    }

    // Comments
    if (
      "comment" in filters &&
      !stringFilter(filters.comment, task.comments.map((comment) => `${comment.author} ${comment.text}`).join("\n"))
    ) {
      result = false;
    }

    // Count comments
    if ("count-comments" in filters && !numberFilter(filters["count-comments"], task.comments.length)) {
      result = false;
    }

    // Custom metadata properties
    if ("customFields" in index.options) {
      for (let customField of index.options.customFields) {
        if (customField.name in filters) {
          if (!(customField.name in task.metadata)) {
            result = false;
          } else {
            switch (customField.type) {
              case "boolean":
                if (task.metadata[customField.name] !== filters[customField.name]) {
                  result = false;
                }
                break;
              case "number":
                if (!numberFilter(filters[customField.name], task.metadata[customField.name])) {
                  result = false;
                }
                break;
              case "string":
                if (!stringFilter(filters[customField.name], task.metadata[customField.name])) {
                  result = false;
                }
                break;
              case "date":
                if (!dateFilter(filters[customField.name], task.metadata[customField.name])) {
                  result = false;
                }
                break;
              default:
                break;
            }
          }
        }
      }
    }
    return result;
  });
}

/**
 * Check if the input string matches the filter regex
 * @param {string|string[]} filter A regular expression or array of regular expressions
 * @param {string} input The string to match against
 * @return {boolean} True if the input matches the string filter
 */
function stringFilter(filter, input) {
  if (Array.isArray(filter)) {
    filter = filter.join("|");
  }
  return new RegExp(filter, "i").test(input);
}

/**
 * Check if the input date matches a date (ignore time part), or if multiple dates are passed in, check if the
 * input date is between the earliest and latest dates
 * @param {Date|Date[]} dates A date or list of dates to check against
 * @param {Date} input The input date to match against
 * @return {boolean} True if the input matches the date filter
 */
function dateFilter(dates, input) {
  dates = utility.arrayArg(dates);
  if (dates.length === 1) {
    return utility.compareDates(input, dates[0]);
  }
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  return input >= earliest && input <= latest;
}

/**
 * Check if the input matches a number, or if multiple numbers are passed in, check if the input is between the
 * minimum and maximum numbers
 * @param {number|number[]} filter A filter number or array of filter numbers
 * @param {number} input The number to match against
 * @return {boolean} True if the input matches the number filter
 */
function numberFilter(filter, input) {
  filter = utility.arrayArg(filter);
  return input >= Math.min(...filter) && input <= Math.max(...filter);
}

/**
 * Calculate task workload
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {number} The task workload
 */
function taskWorkload(index, task) {
  const defaultTaskWorkload =
    "defaultTaskWorkload" in index.options ? index.options.defaultTaskWorkload : DEFAULT_TASK_WORKLOAD;
  const taskWorkloadTags =
    "taskWorkloadTags" in index.options ? index.options.taskWorkloadTags : DEFAULT_TASK_WORKLOAD_TAGS;
  let workload = 0;
  let hasWorkloadTags = false;
  if ("tags" in task.metadata) {
    for (let workloadTag of Object.keys(taskWorkloadTags)) {
      if (task.metadata.tags.indexOf(workloadTag) !== -1) {
        workload += taskWorkloadTags[workloadTag];
        hasWorkloadTags = true;
      }
    }
  }
  if (!hasWorkloadTags) {
    workload = defaultTaskWorkload;
  }
  return workload;
}

/**
 * Get task progress amount
 * @param {object} index
 * @param {object} task
 * @return {number} Task progress
 */
function taskProgress(index, task) {
  if (taskCompleted(index, task)) {
    return 1;
  }
  return "progress" in task.metadata ? task.metadata.progress : 0;
}

/**
 * Calculate task workload statistics between a start and end date
 * @param {object[]} tasks
 * @param {string} metadataProperty
 * @param {Date} start
 * @param {Date} end
 * @return {object} A statistics object
 */
function taskWorkloadInPeriod(tasks, metadataProperty, start, end) {
  const filteredTasks = tasks.filter(
    (task) =>
      metadataProperty in task.metadata &&
      task.metadata[metadataProperty] >= start &&
      task.metadata[metadataProperty] <= end
  );
  return {
    tasks: filteredTasks.map((task) => ({
      id: task.id,
      column: task.column,
      workload: task.workload,
    })),
    workload: filteredTasks.reduce((a, task) => a + task.workload, 0),
  };
}

/**
 * Get a list of tasks that were started before and/or completed after a date
 * @param {object[]} tasks
 * @param {Date} date
 * @return {object[]} A filtered list of tasks
 */
function getActiveTasksAtDate(tasks, date) {
  return tasks.filter((task) => (
    (task.started !== false && task.started <= date) &&
    (task.completed === false || task.completed > date)
  ));
}

/**
 * Calculate the total workload at a specific date
 * @param {object[]} tasks
 * @param {Date} date
 * @return {number} The total workload at the specified date
 */
function getWorkloadAtDate(tasks, date) {
  return getActiveTasksAtDate(tasks, date).reduce((a, task) => (a += task.workload), 0);
}

/**
 * Get the number of tasks that were active at a specific date
 * @param {object[]} tasks
 * @param {Date} date
 * @return {number} The total number of active tasks at the specified date
 */
function countActiveTasksAtDate(tasks, date) {
  return getActiveTasksAtDate(tasks, date).length;
}

/**
 * Get a list of tasks that were started or completed on a specific date
 * @param {object[]} tasks
 * @param {Date} date
 * @return {object[]} A list of event objects, with event type and task id
 */
function getTaskEventsAtDate(tasks, date) {
  return [
    ...tasks
      .filter((task) => (task.created ? task.created.getTime() : 0) === date.getTime())
      .map((task) => ({
        eventType: "created",
        task
      })),
    ...tasks
      .filter((task) => (task.started ? task.started.getTime() : 0) === date.getTime())
      .map((task) => ({
        eventType: "started",
        task
      })),
    ...tasks
      .filter((task) => (task.completed ? task.completed.getTime() : 0) === date.getTime())
      .map((task) => ({
        eventType: "completed",
        task
      })),
  ];
}

/**
 * Quantize a burndown chart date to 1-hour resolution
 * @param {Date} date
 * @param {string} resolution One of 'days', 'hours', 'minutes', 'seconds'
 * @return {Date} The quantized dates
 */
function normaliseDate(date, resolution = 'minutes') {
  const result = new Date(date.getTime());
  switch (resolution) {
    case 'days':
      result.setHours(0);
    case 'hours':
      result.setMinutes(0);
    case 'minutes':
      result.setSeconds(0);
    case 'seconds':
      result.setMilliseconds(0);
    default:
      break;
  }
  return result;
}

/**
 * If a task's column is linked in the index to a custom field with type date, update the custom field's value
 * in the task data with the current date
 * @param {object} index
 * @param {object} taskData
 * @param {string} columnName
 * @return {object} The updated task data
 */
function updateColumnLinkedCustomFields(index, taskData, columnName) {
  // Update built-in column-linked metadata properties first (started and completed dates)
  taskData = updateColumnLinkedCustomField(index, taskData, columnName, "completed", "once");
  taskData = updateColumnLinkedCustomField(index, taskData, columnName, "started", "once");

  // Update column-linked custom fields
  if ("customFields" in index.options) {
    for (let customField of index.options.customFields) {
      if (customField.type === "date") {
        taskData = updateColumnLinkedCustomField(
          index,
          taskData,
          columnName,
          customField.name,
          customField.updateDate || "none"
        );
      }
    }
  }
  return taskData;
}

/**
 * If index options contains a list of columns linked to a custom field name and a task's column matches one
 * of the columns in this list, set the task's custom field value to the current date depending on criteria:
 * - if 'once', update the value only if it's not currently set
 * - if 'always', update the value regardless
 * - otherwise, don't update the value
 * @param {object} index
 * @param {object} taskData
 * @param {string} columnName
 * @param {string} fieldName
 * @param {string} [updateCriteria='none']
 */
function updateColumnLinkedCustomField(index, taskData, columnName, fieldName, updateCriteria = "none") {
  const columnList = `${fieldName}Columns`;
  if (columnList in index.options && index.options[columnList].indexOf(columnName) !== -1) {
    switch (updateCriteria) {
      case "always":
        taskData = setTaskMetadata(taskData, fieldName, new Date());
        break;
      case "once":
        if (!(fieldName in taskData.metadata && taskData.metadata[fieldName])) {
          taskData = setTaskMetadata(taskData, fieldName, new Date());
        }
        break;
      default:
        break;
    }
  }
  return taskData;
}

class Kanbn {
  ROOT = process.cwd();
  CONFIG_YAML = path.join(this.ROOT, "kanbn.yml");
  CONFIG_JSON = path.join(this.ROOT, "kanbn.json");
  
  // Memoize config
  configMemo = null;

  constructor(root = null) {
    if(root) {
      this.ROOT = root
      this.CONFIG_YAML = path.join(this.ROOT, "kanbn.yml");
      this.CONFIG_JSON = path.join(this.ROOT, "kanbn.json");
    }
  }

  /**
   * Check if a separate config file exists
   * @returns {Promise<boolean>} True if a config file exists
   */
  async configExists() {
    return await exists(this.CONFIG_YAML) || await exists(this.CONFIG_JSON);
  }

  /**
   * Save configuration data to a separate config file
   */
  async saveConfig(config) {
    if (await exists(this.CONFIG_YAML)) {
      await fs.promises.writeFile(this.CONFIG_YAML, yaml.stringify(config, 4, 2));
    } else {
      await fs.promises.writeFile(this.CONFIG_JSON, JSON.stringify(config, null, 4));
    }
  }

  /**
   * Get configuration settings from the config file if it exists, otherwise return null
   * @return {Promise<Object|null>} Configuration settings or null if there is no separate config file
   */
  async getConfig() {
    if (this.configMemo === null) {
      let config = null;
      if (await exists(this.CONFIG_YAML)) {
        try {
          config = yaml.load(this.CONFIG_YAML);
        } catch (error) {
          throw new Error(`Couldn't load config file: ${error.message}`);
        }
      } else if (await exists(this.CONFIG_JSON)) {
        try {
          config = JSON.parse(await fs.promises.readFile(this.CONFIG_JSON, { encoding: "utf-8" }));
        } catch (error) {
          throw new Error(`Couldn't load config file: ${error.message}`);
        }
      }
      this.configMemo = config;
    }
    return this.configMemo;
  }

  /**
   * Clear cached config
   */
  clearConfigCache() {
    this.configMemo = null;
  }

  /**
   * Get the name of the folder where the index and tasks are stored
   * @return {Promise<string>} The kanbn folder name
   */
  async getFolderName() {
    const config = await this.getConfig();
    if (config !== null && 'mainFolder' in config) {
      return config.mainFolder;
    }
    return DEFAULT_FOLDER_NAME;
  }

  /**
   * Get the index filename
   * @return {Promise<string>} The index filename
   */
  async getIndexFileName() {
    const config = await this.getConfig();
    if (config !== null && 'indexFile' in config) {
      return config.indexFile;
    }
    return DEFAULT_INDEX_FILE_NAME;
  }

  /**
   * Get the name of the folder where tasks are stored
   * @return {Promise<string>} The task folder name
   */
  async getTaskFolderName() {
    const config = await this.getConfig();
    if (config !== null && 'taskFolder' in config) {
      return config.taskFolder;
    }
    return DEFAULT_TASKS_FOLDER_NAME;
  }

  /**
   * Get the name of the archive folder
   * @return {Promise<string>} The archive folder name
   */
  async getArchiveFolderName() {
    const config = await this.getConfig();
    if (config !== null && 'archiveFolder' in config) {
      return config.archiveFolder;
    }
    return DEFAULT_ARCHIVE_FOLDER_NAME;
  }

  /**
   * Get the kanbn folder location for the current working directory
   * @return {Promise<string>} The kanbn folder path
   */
  async getMainFolder() {
    return path.join(this.ROOT, await this.getFolderName());
  }

  /**
   * Get the index path
   * @return {Promise<string>} The kanbn index path
   */
  async getIndexPath() {
    return path.join(await this.getMainFolder(), await this.getIndexFileName());
  }

  /**
   * Get the task folder path
   * @return {Promise<string>} The kanbn task folder path
   */
  async getTaskFolderPath() {
    return path.join(await this.getMainFolder(), await this.getTaskFolderName());
  }

  /**
   * Get the archive folder path
   * @return {Promise<string>} The kanbn archive folder path
   */
  async getArchiveFolderPath() {
    return path.join(await this.getMainFolder(), await this.getArchiveFolderName());
  }

  /**
   * Get the index as an object
   * @return {Promise<index>} The index
   */
  async getIndex() {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    return this.loadIndex();
  }

  /**
   * Get a task as an object
   * @param {string} taskId The task id to get
   * @return {Promise<task>} The task
   */
  async getTask(taskId) {
    this.taskExists(taskId);
    return this.loadTask(taskId);
  }

  /**
   * Add additional index-based information to a task
   * @param {index} index The index object
   * @param {task} task The task object
   * @return {task} The hydrated task
   */
  hydrateTask(index, task) {
    const completed = taskCompleted(index, task);
    task.column = findTaskColumn(index, task.id);
    task.workload = taskWorkload(index, task);

    // Add progress information
    task.progress = taskProgress(index, task);
    task.remainingWorkload = Math.ceil(task.workload * (1 - task.progress));

    // Add due information
    if ("due" in task.metadata) {
      const dueData = {};

      // A task is overdue if it's due date is in the past and the task is not in a completed column
      // or doesn't have a completed dates
      const completedDate = "completed" in task.metadata ? task.metadata.completed : null;

      // Get task due delta - this is the difference between now and the due date, or if the task is completed
      // this is the difference between the completed and due dates
      let delta;
      if (completedDate !== null) {
        delta = completedDate - task.metadata.due;
      } else {
        delta = new Date() - task.metadata.due;
      }

      // Populate due information
      dueData.completed = completed;
      dueData.completedDate = completedDate;
      dueData.dueDate = task.metadata.due;
      dueData.overdue = !completed && delta > 0;
      dueData.dueDelta = delta;

      // Prepare a due message for the task
      let dueMessage = "";
      if (completed) {
        dueMessage += "Completed ";
      }
      dueMessage += `${humanizeDuration(delta, {
        largest: 3,
        round: true,
      })} ${delta > 0 ? "overdue" : "remaining"}`;
      dueData.dueMessage = dueMessage;
      task.dueData = dueData;
    }
    return task;
  }

  /**
   * Return a filtered and sorted list of tasks
   * @param {index} index The index object
   * @param {task[]} tasks A list of task objects
   * @param {object} filters A list of task filters
   * @param {object[]} sorters A list of task sorters
   * @return {object[]} A filtered and sorted list of tasks
   */
  filterAndSortTasks(index, tasks, filters, sorters) {
    return sortTasks(filterTasks(index, tasks, filters), sorters);
  }

  /**
   * Overwrite the index file with the specified data
   * @param {object} indexData Index data to save
   */
  async saveIndex(indexData) {
    // Apply column sorting if any sorters are defined in options
    if ("columnSorting" in indexData.options && Object.keys(indexData.options.columnSorting).length) {
      for (let columnName in indexData.options.columnSorting) {
        indexData = sortColumnInIndex(
          indexData,
          await this.loadAllTrackedTasks(indexData, columnName),
          columnName,
          indexData.options.columnSorting[columnName]
        );
      }
    }

    // If there is a separate config file, save options to this file
    let ignoreOptions = false;
    if (await this.configExists()) {
      await this.saveConfig(indexData.options);
      ignoreOptions = true;
    }

    // Save index
    await fs.promises.writeFile(await this.getIndexPath(), parseIndex.json2md(indexData, ignoreOptions));
  }

  /**
   * Load the index file and parse it to an object
   * @return {Promise<object>} The index object
   */
  async loadIndex() {
    let indexData = "";
    try {
      indexData = await fs.promises.readFile(await this.getIndexPath(), { encoding: "utf-8" });
    } catch (error) {
      throw new Error(`Couldn't access index file: ${error.message}`);
    }
    const index = parseIndex.md2json(indexData);

    // If configuration settings exist in a separate config file, merge them with index options
    const config = await this.getConfig();
    if (config !== null) {
      index.options = { ...index.options, ...config };
    }
    return index;
  }

  /**
   * Overwrite a task file with the specified data
   * @param {string} path The task path
   * @param {object} taskData The task data
   */
  async saveTask(path, taskData) {
    await fs.promises.writeFile(path, parseTask.json2md(taskData));
  }

  /**
   * Load a task file and parse it to an object
   * @param {string} taskId The task id
   * @return {Promise<object>} The task object
   */
  async loadTask(taskId) {
    const taskPath = path.join(await this.getTaskFolderPath(), addFileExtension(taskId));
    let taskData = "";
    try {
      taskData = await fs.promises.readFile(taskPath, { encoding: "utf-8" });
    } catch (error) {
      throw new Error(`Couldn't access task file: ${error.message}`);
    }
    return parseTask.md2json(taskData);
  }

  /**
   * Load all tracked tasks and return an array of task objects
   * @param {object} index The index object
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {Promise<object[]>} All tracked tasks
   */
  async loadAllTrackedTasks(index, columnName = null) {
    const result = [];
    const trackedTasks = getTrackedTaskIds(index, columnName);
    for (let taskId of trackedTasks) {
      result.push(await this.loadTask(taskId));
    }
    return result;
  }

  /**
   * Load a task file from the archive and parse it to an object
   * @param {string} taskId The task id
   * @return {Promise<object>} The task object
   */
  async loadArchivedTask(taskId) {
    const taskPath = path.join(await this.getArchiveFolderPath(), addFileExtension(taskId));
    let taskData = "";
    try {
      taskData = await fs.promises.readFile(taskPath, { encoding: "utf-8" });
    } catch (error) {
      throw new Error(`Couldn't access archived task file: ${error.message}`);
    }
    return parseTask.md2json(taskData);
  }

  /**
   * Get the date format defined in the index, or the default date format
   * @param {object} index The index object
   * @return {string} The date format
   */
  getDateFormat(index) {
    return "dateFormat" in index.options ? index.options.dateFormat : DEFAULT_DATE_FORMAT;
  }

  /**
   * Get the task template for displaying tasks on the kanbn board from the index, or the default task template
   * @param {object} index The index object
   * @return {string} The task template
   */
  getTaskTemplate(index) {
    return "taskTemplate" in index.options ? index.options.taskTemplate : DEFAULT_TASK_TEMPLATE;
  }

  /**
   * Check if the current working directory has been initialised
   * @return {Promise<boolean>} True if the current working directory has been initialised, otherwise false
   */
  async initialised() {
    return await exists(await this.getIndexPath());
  }

  /**
   * Initialise a kanbn board in the current working directory
   * @param {object} [options={}] Initial columns and other config options
   */
  async initialise(options = {}) {
    // Check if a main folder is defined in an existing config file
    const mainFolder = await this.getMainFolder();

    // Create main folder if it doesn't already exist
    if (!(await exists(mainFolder))) {
      await fs.promises.mkdir(mainFolder, { recursive: true });
    }

    // Create tasks folder if it doesn't already exist
    const taskFolder = await this.getTaskFolderPath();
    if (!(await exists(taskFolder))) {
      await fs.promises.mkdir(taskFolder, { recursive: true });
    }

    // Create index if one doesn't already exist
    let index;
    if (!(await exists(await this.getIndexPath()))) {

      // If config already exists in a separate file, merge it into the options
      const config = await this.getConfig();

      // Create initial options
      const opts = Object.assign({}, defaultInitialiseOptions, options);
      index = {
        name: opts.name,
        description: opts.description,
        options: Object.assign({}, opts.options, config || {}),
        columns: Object.fromEntries(opts.columns.map((columnName) => [columnName, []])),
      };

      // Otherwise, if index already exists and we have specified new settings, re-write the index file
    } else if (Object.keys(options).length > 0) {
      index = await this.loadIndex();
      "name" in options && (index.name = options.name);
      "description" in options && (index.description = options.description);
      "options" in options && (index.options = Object.assign(index.options, options.options));
      "columns" in options &&
        (index.columns = Object.assign(
          index.columns,
          Object.fromEntries(
            options.columns.map((columnName) => [
              columnName,
              columnName in index.columns ? index.columns[columnName] : [],
            ])
          )
        ));
    }
    await this.saveIndex(index);
  }

  /**
   * Check if a task file exists and is in the index, otherwise throw an error
   * @param {string} taskId The task id to check
   */
  async taskExists(taskId) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Check if the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Check that the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`No task with id "${taskId}" found in the index`);
    }
  }

  /**
   * Get the column that a task is in or throw an error if the task doesn't exist or isn't indexed
   * @param {string} taskId The task id to find
   * @return {Promise<string>} The name of the column the task is in
   */
  async findTaskColumn(taskId) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Check if the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Check that the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`No task with id "${taskId}" found in the index`);
    }

    // Find which column the task is in
    return findTaskColumn(index, taskId);
  }

  /**
   * Create a task file and add the task to the index
   * @param {object} taskData The task object
   * @param {string} columnName The name of the column to add the task to
   * @return {Promise<string>} The id of the task that was created
   */
  async createTask(taskData, columnName) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Make sure the task has a name
    if (!taskData.name) {
      throw new Error("Task name cannot be blank");
    }

    // Make sure a task doesn't already exist with the same name
    const taskId = utility.getTaskId(taskData.name);
    const taskPath = getTaskPath(await this.getTaskFolderPath(), taskId);
    if (await exists(taskPath)) {
      throw new Error(`A task with id "${taskId}" already exists`);
    }

    // Get index and make sure the column exists
    let index = await this.loadIndex();
    if (!(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }

    // Check that a task with the same id isn't already indexed
    if (taskInIndex(index, taskId)) {
      throw new Error(`A task with id "${taskId}" is already in the index`);
    }

    // Set the created date
    taskData = setTaskMetadata(taskData, "created", new Date());

    // Update task metadata dates
    taskData = updateColumnLinkedCustomFields(index, taskData, columnName);
    await this.saveTask(taskPath, taskData);

    // Add the task to the index
    index = addTaskToIndex(index, taskId, columnName);
    await this.saveIndex(index);
    return taskId;
  }

  /**
   * Add an untracked task to the specified column in the index
   * @param {string} taskId The untracked task id
   * @param {string} columnName The column to add the task to
   * @return {Promise<string>} The id of the task that was added
   */
  async addUntrackedTaskToIndex(taskId, columnName) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Make sure the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Get index and make sure the column exists
    let index = await this.loadIndex();
    if (!(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }

    // Check that the task isn't already indexed
    if (taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is already in the index`);
    }

    // Load task data
    let taskData = await this.loadTask(taskId);
    const taskPath = getTaskPath(await this.getTaskFolderPath(), taskId);

    // Update task metadata dates
    taskData = updateColumnLinkedCustomFields(index, taskData, columnName);
    await this.saveTask(taskPath, taskData);

    // Add the task to the column and save the index
    index = addTaskToIndex(index, taskId, columnName);
    await this.saveIndex(index);
    return taskId;
  }

  /**
   * Get a list of tracked tasks (i.e. tasks that are listed in the index)
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {Promise<Set>} A set of task ids
   */
  async findTrackedTasks(columnName = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Get all tasks currently in index
    const index = await this.loadIndex();
    return getTrackedTaskIds(index, columnName);
  }

  /**
   * Get a list of untracked tasks (i.e. markdown files in the tasks folder that aren't listed in the index)
   * @return {Promise<Set>} A set of untracked task ids
   */
  async findUntrackedTasks() {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Get all tasks currently in index
    const index = await this.loadIndex();
    const trackedTasks = getTrackedTaskIds(index);

    // Get all tasks in the tasks folder
    const files = await glob(`${await this.getTaskFolderPath()}/*.md`);
    const untrackedTasks = new Set(files.map((task) => path.parse(task).name));

    // Return the set difference
    return new Set([...untrackedTasks].filter((x) => !trackedTasks.has(x)));
  }

  /**
   * Update an existing task
   * @param {string} taskId The id of the task to update
   * @param {object} taskData The new task data
   * @param {?string} [columnName=null] The column name to move this task to, or null if not moving this task
   * @return {Promise<string>} The id of the task that was updated
   */
  async updateTask(taskId, taskData, columnName = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Make sure the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Get index and make sure the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is not in the index`);
    }

    // Make sure the updated task data has a name
    if (!taskData.name) {
      throw new Error("Task name cannot be blank");
    }

    // Rename the task if we're updating the name
    const originalTaskData = await this.loadTask(taskId);
    if (originalTaskData.name !== taskData.name) {
      taskId = await this.renameTask(taskId, taskData.name);

      // Re-load the index
      index = await this.loadIndex();
    }

    // Get index and make sure the column exists
    if (columnName && !(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }

    // Set the updated date
    taskData = setTaskMetadata(taskData, "updated", new Date());

    // Save task
    await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);

    // Move the task if we're updating the column
    if (columnName) {
      await this.moveTask(taskId, columnName);

      // Otherwise save the index
    } else {
      await this.saveIndex(index);
    }
    return taskId;
  }

  /**
   * Change a task name, rename the task file and update the task id in the index
   * @param {string} taskId The id of the task to rename
   * @param {string} newTaskName The new task name
   * @return {Promise<string>} The new id of the task that was renamed
   */
  async renameTask(taskId, newTaskName) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Make sure the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Get index and make sure the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is not in the index`);
    }

    // Make sure there isn't already a task with the new task id
    const newTaskId = utility.getTaskId(newTaskName);
    const newTaskPath = getTaskPath(await this.getTaskFolderPath(), newTaskId);
    if (await exists(newTaskPath)) {
      throw new Error(`A task with id "${newTaskId}" already exists`);
    }

    // Check that a task with the new id isn't already indexed
    if (taskInIndex(index, newTaskId)) {
      throw new Error(`A task with id "${newTaskId}" is already in the index`);
    }

    // Update the task name and updated date
    let taskData = await this.loadTask(taskId);
    taskData.name = newTaskName;
    taskData = setTaskMetadata(taskData, "updated", new Date());
    await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);

    // Rename the task file
    await fs.promises.rename(getTaskPath(await this.getTaskFolderPath(), taskId), newTaskPath);

    // Update the task id in the index
    index = renameTaskInIndex(index, taskId, newTaskId);
    await this.saveIndex(index);
    return newTaskId;
  }

  /**
   * Move a task from one column to another column
   * @param {string} taskId The task id to move
   * @param {string} columnName The name of the column that the task will be moved to
   * @param {?number} [position=null] The position to move the task to within the target column
   * @param {boolean} [relative=false] Treat the position argument as relative instead of absolute
   * @return {Promise<string>} The id of the task that was moved
   */
  async moveTask(taskId, columnName, position = null, relative = false) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Make sure the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Get index and make sure the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is not in the index`);
    }

    // Make sure the target column exists
    if (!(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }

    // Update the task's updated date
    let taskData = await this.loadTask(taskId);
    taskData = setTaskMetadata(taskData, "updated", new Date());

    // Update task metadata dates
    taskData = updateColumnLinkedCustomFields(index, taskData, columnName);
    await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);

    // If we're moving the task to a new position, calculate the absolute position
    const currentColumnName = findTaskColumn(index, taskId);
    const currentPosition = index.columns[currentColumnName].indexOf(taskId);
    if (position) {
      if (relative) {
        position = currentPosition + position;
      }
      position = Math.max(Math.min(position, index.columns[currentColumnName].length), 0);
    }

    // Remove the task from its current column and add it to the new column
    index = removeTaskFromIndex(index, taskId);
    index = addTaskToIndex(index, taskId, columnName, position);
    await this.saveIndex(index);
    return taskId;
  }

  /**
   * Remove a task from the index and optionally delete the task file as well
   * @param {string} taskId The id of the task to remove
   * @param {boolean} [removeFile=false] True if the task file should be removed
   * @return {Promise<string>} The id of the task that was deleted
   */
  async deleteTask(taskId, removeFile = false) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Get index and make sure the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is not in the index`);
    }

    // Remove the task from whichever column it's in
    index = removeTaskFromIndex(index, taskId);

    // Optionally remove the task file as well
    if (removeFile && (await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      await fs.promises.unlink(getTaskPath(await this.getTaskFolderPath(), taskId));
    }
    await this.saveIndex(index);
    return taskId;
  }

  /**
   * Search for indexed tasks
   * @param {object} [filters={}] The filters to apply
   * @param {boolean} [quiet=false] Only return task ids if true, otherwise return full task details
   * @return {Promise<object[]>} A list of tasks that match the filters
   */
  async search(filters = {}, quiet = false) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Load all tracked tasks and filter the results
    const index = await this.loadIndex();
    let tasks = filterTasks(index, await this.loadAllTrackedTasks(index), filters);

    // Return resulting task ids or the full tasks
    return tasks.map((task) => {
      return quiet ? utility.getTaskId(task.name) : this.hydrateTask(index, task);
    });
  }

  /**
   * Output project status information
   * @param {boolean} [quiet=false] Output full or partial status information
   * @param {boolean} [untracked=false] Show a list of untracked tasks
   * @param {boolean} [due=false] Show information about overdue tasks and time remaining
   * @param {?string|?number} [sprint=null] The sprint name or number to show stats for, or null for current sprint
   * @param {?Date[]} [dates=null] The date(s) to show stats for, or null for no date filter
   * @return {Promise<object|string[]>} Project status information as an object, or an array of untracked task filenames
   */
  async status(quiet = false, untracked = false, due = false, sprint = null, dates = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Get index and column names
    const index = await this.loadIndex();
    const columnNames = Object.keys(index.columns);

    // Prepare output
    const result = {
      name: index.name,
    };

    // Get un-tracked tasks if required
    if (untracked) {
      result.untrackedTasks = [...(await this.findUntrackedTasks())].map((taskId) => `${taskId}.md`);

      // If output is quiet, output a list of untracked task filenames
      if (quiet) {
        return result.untrackedTasks;
      }
    }

    // Get basic project status information
    result.tasks = columnNames.reduce((a, v) => a + index.columns[v].length, 0);
    result.columnTasks = Object.fromEntries(
      columnNames.map((columnName) => [columnName, index.columns[columnName].length])
    );
    if ("startedColumns" in index.options && index.options.startedColumns.length > 0) {
      result.startedTasks = Object.entries(index.columns)
        .filter((c) => index.options.startedColumns.indexOf(c[0]) > -1)
        .reduce((a, c) => a + c[1].length, 0);
    }
    if ("completedColumns" in index.options && index.options.completedColumns.length > 0) {
      result.completedTasks = Object.entries(index.columns)
        .filter((c) => index.options.completedColumns.indexOf(c[0]) > -1)
        .reduce((a, c) => a + c[1].length, 0);
    }

    // If required, load more detailed task information
    if (!quiet) {
      // Load all tracked tasks and hydrate them
      const tasks = [...(await this.loadAllTrackedTasks(index))].map((task) => this.hydrateTask(index, task));

      // If showing due information, calculate time remaining or overdue time for each task
      if (due) {
        result.dueTasks = [];
        tasks.forEach((task) => {
          if ("dueData" in task) {
            result.dueTasks.push({
              task: task.id,
              workload: task.workload,
              progress: task.progress,
              remainingWorkload: task.remainingWorkload,
              ...task.dueData,
            });
          }
        });
      }

      // Calculate total and per-column workload
      let totalWorkload = 0,
        totalRemainingWorkload = 0;
      const columnWorkloads = tasks.reduce(
        (a, task) => {
          totalWorkload += task.workload;
          totalRemainingWorkload += task.remainingWorkload;
          a[task.column].workload += task.workload;
          a[task.column].remainingWorkload += task.remainingWorkload;
          return a;
        },
        Object.fromEntries(
          columnNames.map((columnName) => [
            columnName,
            {
              workload: 0,
              remainingWorkload: 0,
            },
          ])
        )
      );
      result.totalWorkload = totalWorkload;
      result.totalRemainingWorkload = totalRemainingWorkload;
      result.columnWorkloads = columnWorkloads;
      result.taskWorkloads = Object.fromEntries(
        tasks.map((task) => [
          task.id,
          {
            workload: task.workload,
            progress: task.progress,
            remainingWorkload: task.remainingWorkload,
            completed: taskCompleted(index, task),
          },
        ])
      );

      // Calculate assigned task totals and workloads
      const assignedTasks = tasks.reduce((a, task) => {
        if ("assigned" in task.metadata) {
          if (!(task.metadata.assigned in a)) {
            a[task.metadata.assigned] = {
              total: 0,
              workload: 0,
              remainingWorkload: 0,
            };
          }
          a[task.metadata.assigned].total++;
          a[task.metadata.assigned].workload += task.workload;
          a[task.metadata.assigned].remainingWorkload += task.remainingWorkload;
        }
        return a;
      }, {});
      if (Object.keys(assignedTasks).length > 0) {
        result.assigned = assignedTasks;
      }

      // If any sprints are defined in index options, calculate sprint statistics
      if ("sprints" in index.options && index.options.sprints.length) {
        const sprints = index.options.sprints;

        // Default to current sprint
        const currentSprint = index.options.sprints.length;
        let sprintIndex = currentSprint - 1;

        // Check if we're requesting stats for a specific sprint
        if (sprint !== null) {
          // Select sprint by number (1-based index)
          if (typeof sprint === "number") {
            if (sprint < 1 || sprint > sprints.length) {
              throw new Error(`Sprint ${sprint} does not exist`);
            } else {
              sprintIndex = sprint - 1;
            }

            // Or select sprint by name
          } else if (typeof sprint === "string") {
            sprintIndex = sprints.findIndex((s) => s.name === sprint);
            if (sprintIndex === -1) {
              throw new Error(`No sprint found with name "${sprint}"`);
            }
          }
        }

        // Add sprint information
        result.sprint = {
          number: sprintIndex + 1,
          name: sprints[sprintIndex].name,
          start: sprints[sprintIndex].start,
        };
        if (currentSprint - 1 !== sprintIndex) {
          if (sprintIndex === sprints.length - 1) {
            result.sprint.end = sprints[sprintIndex + 1].start;
          }
          result.sprint.current = currentSprint;
        }
        if (sprints[sprintIndex].description) {
          result.sprint.description = sprints[sprintIndex].description;
        }
        const sprintStartDate = sprints[sprintIndex].start;
        const sprintEndDate = sprintIndex === sprints.length - 1 ? new Date() : sprints[sprintIndex + 1].start;

        // Calculate sprint duration
        const duration = sprintEndDate - sprintStartDate;
        result.sprint.durationDelta = duration;
        result.sprint.durationMessage = humanizeDuration(duration, {
          largest: 3,
          round: true,
        });

        // Add task workload information for the sprint
        result.sprint.created = taskWorkloadInPeriod(tasks, "created", sprintStartDate, sprintEndDate);
        result.sprint.started = taskWorkloadInPeriod(tasks, "started", sprintStartDate, sprintEndDate);
        result.sprint.completed = taskWorkloadInPeriod(tasks, "completed", sprintStartDate, sprintEndDate);
        result.sprint.due = taskWorkloadInPeriod(tasks, "due", sprintStartDate, sprintEndDate);

        // Add custom date property workload information for the sprint
        if ("customFields" in index.options) {
          for (let customField of index.options.customFields) {
            if (customField.type === "date") {
              result.sprint[customField.name] = taskWorkloadInPeriod(
                tasks,
                customField.name,
                sprintStartDate,
                sprintEndDate
              );
            }
          }
        }
      }

      // If any dates were specified, calculate task statistics for these dates
      if (dates !== null && dates.length > 0) {
        let periodStart, periodEnd;
        result.period = {};
        if (dates.length === 1) {
          periodStart = new Date(+dates[0]);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(+dates[0]);
          periodEnd.setHours(23, 59, 59, 999);
          result.period.start = periodStart;
          result.period.end = periodEnd;
        } else {
          result.period.start = periodStart = new Date(Math.min(...dates));
          result.period.end = periodEnd = new Date(Math.max(...dates));
        }
        result.period.created = taskWorkloadInPeriod(tasks, "created", periodStart, periodEnd);
        result.period.started = taskWorkloadInPeriod(tasks, "started", periodStart, periodEnd);
        result.period.completed = taskWorkloadInPeriod(tasks, "completed", periodStart, periodEnd);
        result.period.due = taskWorkloadInPeriod(tasks, "due", periodStart, periodEnd);

        // Add custom date property workload information for the selected date range
        if ("customFields" in index.options) {
          for (let customField of index.options.customFields) {
            if (customField.type === "date") {
              result.sprint[customField.name] = taskWorkloadInPeriod(tasks, customField.name, periodStart, periodEnd);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Validate the index and task files
   * @param {boolean} [save=false] Re-save all files
   * @return {Promise<boolean>} True if everything validated, otherwise an array of parsing errors
   */
  async validate(save = false) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    const errors = [];

    // Load & parse index
    let index = null;
    try {
      index = await this.loadIndex();

      // Re-save index if required
      if (save) {
        await this.saveIndex(index);
      }
    } catch (error) {
      errors.push({
        task: null,
        errors: error.message,
      });
    }

    // Exit early if any errors were found in the index
    if (errors.length) {
      return errors;
    }

    // Load & parse tasks
    const trackedTasks = getTrackedTaskIds(index);
    for (let taskId of trackedTasks) {
      try {
        const task = await this.loadTask(taskId);

        // Re-save tasks if required
        if (save) {
          await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), task);
        }
      } catch (error) {
        errors.push({
          task: taskId,
          errors: error.message,
        });
      }
    }

    // Return a list of errors or true if there were no errors
    if (errors.length) {
      return errors;
    }
    return true;
  }

  /**
   * Sort a column in the index
   * @param {string} columnName The column name to sort
   * @param {object[]} sorters A list of objects containing the field to sort by, filters and sort order
   * @param {boolean} [save=false] True if the settings should be saved in index
   */
  async sort(columnName, sorters, save = false) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Get index and make sure the column exists
    let index = await this.loadIndex();
    if (!(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }

    // Save the sorter settings if required (the column will be sorted when saving the index)
    if (save) {
      if (!("columnSorting" in index.options)) {
        index.options.columnSorting = {};
      }
      index.options.columnSorting[columnName] = sorters;

      // Otherwise, remove sorting settings for the specified column and manually sort the column
    } else {
      if ("columnSorting" in index.options && columnName in index.options.columnSorting) {
        delete index.options.columnSorting[columnName];
      }
      const tasks = await this.loadAllTrackedTasks(index, columnName);
      index = sortColumnInIndex(index, tasks, columnName, sorters);
    }
    await this.saveIndex(index);
  }

  /**
   * Start a sprint
   * @param {string} name Sprint name
   * @param {string} description Sprint description
   * @param {Date} start Sprint start date
   * @return {Promise<object>} The sprint object
   */
  async sprint(name, description, start) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Get index and make sure it has a list of sprints in the options
    const index = await this.loadIndex();
    if (!("sprints" in index.options)) {
      index.options.sprints = [];
    }
    const sprintNumber = index.options.sprints.length + 1;
    const sprint = {
      start: start,
    };

    // If the name is blank, generate a default name
    if (!name) {
      sprint.name = `Sprint ${sprintNumber}`;
    } else {
      sprint.name = name;
    }

    // Add description if one exists
    if (description) {
      sprint.description = description;
    }

    // Add sprint and save the index
    index.options.sprints.push(sprint);
    await this.saveIndex(index);
    return sprint;
  }

  /**
   * Output burndown chart data
   * @param {?string[]} [sprints=null] The sprint names or numbers to show a chart for, or null for
   * the current sprint
   * @param {?Date[]} [dates=null] The dates to show a chart for, or null for no date filter
   * @param {?string} [assigned=null] The assigned user to filter for, or null for no assigned filter
   * @param {?string[]} [columns=null] The columns to filter for, or null for no column filter
   * @param {?string} [normalise=null] The date normalisation mode
   * @return {Promise<object>} Burndown chart data as an object
   */
  async burndown(sprints = null, dates = null, assigned = null, columns = null, normalise = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Get index and tasks
    const index = await this.loadIndex();
    const tasks = [...(await this.loadAllTrackedTasks(index))]
      .map((task) => {
        const created = "created" in task.metadata ? task.metadata.created : new Date(0);
        return {
          ...task,
          created,
          started:
            "started" in task.metadata
              ? task.metadata.started
              : "startedColumns" in index.options && index.options.startedColumns.indexOf(task.column) !== -1
              ? created
              : false,
          completed:
            "completed" in task.metadata
              ? task.metadata.completed
              : "completedColumns" in index.options && index.options.completedColumns.indexOf(task.column) !== -1
              ? created
              : false,
          progress: taskProgress(index, task),
          assigned: "assigned" in task.metadata ? task.metadata.assigned : null,
          workload: taskWorkload(index, task),
          column: findTaskColumn(index, task.id),
        };
      })
      .filter(
        (task) =>
          (assigned === null || task.assigned === assigned) &&
          (columns === null || columns.indexOf(task.column) !== -1)
      );

    // Get sprints and dates to plot from arguments
    const series = [];
    const indexSprints = "sprints" in index.options && index.options.sprints.length ? index.options.sprints : null;
    if (sprints === null && dates === null) {
      if (indexSprints !== null) {
        // Show current sprint
        const currentSprint = indexSprints.length - 1;
        series.push({
          sprint: indexSprints[currentSprint],
          from: new Date(indexSprints[currentSprint].start),
          to: new Date(),
        });
      } else {
        // Show all time
        series.push({
          from: new Date(
            Math.min(
              ...tasks
                .map((t) =>
                  [
                    "created" in t.metadata && t.metadata.created,
                    "started" in t.metadata && t.metadata.started,
                    "completed" in t.metadata && (t.metadata.completed || new Date(8640000000000000))
                  ].filter((d) => d)
                )
                .flat()
            )
          ),
          to: new Date(),
        });
      }
    } else {
      // Show specified sprint
      if (sprints !== null) {
        if (indexSprints === null) {
          throw new Error(`No sprints defined`);
        } else {
          for (sprint of sprints) {
            let sprintIndex = null;

            // Select sprint by number (1-based index)
            if (typeof sprint === "number") {
              if (sprint < 1 || sprint > indexSprints.length) {
                throw new Error(`Sprint ${sprint} does not exist`);
              } else {
                sprintIndex = sprint - 1;
              }

              // Or select sprint by name
            } else if (typeof sprint === "string") {
              sprintIndex = indexSprints.findIndex((s) => s.name === sprint);
              if (sprintIndex === -1) {
                throw new Error(`No sprint found with name "${sprint}"`);
              }
            }
            if (sprintIndex === null) {
              throw new Error(`Invalid sprint "${sprint}"`);
            }

            // Get sprint start and end
            series.push({
              sprint: indexSprints[sprintIndex],
              from: new Date(indexSprints[sprintIndex].start),
              to: sprintIndex < indexSprints.length - 1 ? new Date(indexSprints[sprintIndex + 1].start) : new Date(),
            });
          }
        }
      }

      // Show specified date range
      if (dates !== null) {
        series.push({
          from: new Date(Math.min(...dates)),
          to: dates.length === 1 ? new Date() : new Date(Math.max(...dates)),
        });
      }
    }

    // If normalise mode is 'auto', find the most appropriate normalisation mode
    if (normalise === 'auto') {
      const delta = series[0].to - series[0].from;
      if (delta >= DAY * 7) {
        normalise = 'days';
      } else if (delta >= DAY) {
        normalise = 'hours';
      } else if (delta >= HOUR ) {
        normalise = 'minutes';
      } else {
        normalise = 'seconds';
      }
    }
    if (normalise !== null) {

      // Normalize series from and to dates
      series.forEach((s) => {
        s.from = normaliseDate(s.from, normalise);
        s.to = normaliseDate(s.to, normalise);
      });

      // Normalise task dates
      tasks.forEach((task) => {
        if (task.created) {
          task.created = normaliseDate(task.created, normalise);
        }
        if (task.started) {
          task.started = normaliseDate(task.started, normalise);
        }
        if (task.completed) {
          task.completed = normaliseDate(task.completed, normalise);
        }
      });
    }

    // Get workload datapoints for each period
    series.forEach((s) => {
      s.dataPoints = [
        {
          x: s.from,
          y: getWorkloadAtDate(tasks, s.from),
          count: countActiveTasksAtDate(tasks, s.from),
          tasks: getTaskEventsAtDate(tasks, s.from),
        },
        ...tasks
          .filter((task) => {
            let result = false;
            if (task.created && task.created >= s.from && task.created <= s.to) {
              result = true;
            }
            if (task.started && task.started >= s.from && task.started <= s.to) {
              result = true;
            }
            if (task.completed && task.completed >= s.from && task.completed <= s.to) {
              result = true;
            }
            return result;
          })
          .map((task) => [
            task.created,
            task.started,
            task.completed
          ])
          .flat()
          .filter((d) => d)
          .map((x) => ({
            x,
            y: getWorkloadAtDate(tasks, x),
            count: countActiveTasksAtDate(tasks, x),
            tasks: getTaskEventsAtDate(tasks, x),
          })),
        {
          x: s.to,
          y: getWorkloadAtDate(tasks, s.to),
          count: countActiveTasksAtDate(tasks, s.to),
          tasks: getTaskEventsAtDate(tasks, s.to),
        },
      ].sort((a, b) => a.x.getTime() - b.x.getTime());
    });
    return { series };
  }

  /**
   * Add a comment to a task
   * @param {string} taskId The task id
   * @param {string} text The comment text
   * @param {string} author The comment author
   * @return {Promise<string>} The task id
   */
  async comment(taskId, text, author) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Make sure the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Get index and make sure the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is not in the index`);
    }

    // Make sure the comment text isn't empty
    if (!text) {
      throw new Error("Comment text cannot be empty");
    }

    // Add the comment
    const taskData = await this.loadTask(taskId);
    const taskPath = getTaskPath(await this.getTaskFolderPath(), taskId);
    taskData.comments.push({
      text,
      author,
      date: new Date(),
    });

    // Save the task
    await this.saveTask(taskPath, taskData);
    return taskId;
  }

  /**
   * Return a list of archived tasks
   * @return {Promise<string[]>} A list of archived task ids
   */
  async listArchivedTasks() {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Make sure the archive folder exists
    const archiveFolder = await this.getArchiveFolderPath();
    if (!(await exists(archiveFolder))) {
      throw new Error("Archive folder doesn't exist");
    }

    // Get a list of archived task files
    const files = await glob(`${archiveFolder}/*.md`);
    return [...new Set(files.map((task) => path.parse(task).name))];
  }

  /**
   * Move a task to the archive
   * @param {string} taskId The task id
   * @return {Promise<string>} The task id
   */
  async archiveTask(taskId) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    // Make sure the task file exists
    if (!(await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      throw new Error(`No task file found with id "${taskId}"`);
    }

    // Get index and make sure the task is indexed
    let index = await this.loadIndex();
    if (!taskInIndex(index, taskId)) {
      throw new Error(`Task "${taskId}" is not in the index`);
    }

    // Make sure there isn't already an archived task with the same id
    const archiveFolder = await this.getArchiveFolderPath();
    const archivedTaskPath = getTaskPath(archiveFolder, taskId);
    if (await exists(archivedTaskPath)) {
      throw new Error(`An archived task with id "${taskId}" already exists`);
    }

    // Create archive folder if it doesn't already exist
    if (!(await exists(archiveFolder))) {
      await fs.promises.mkdir(archiveFolder, { recursive: true });
    }

    // Save the column name in the task's metadata
    let taskData = await this.loadTask(taskId);
    taskData = setTaskMetadata(taskData, "column", findTaskColumn(index, taskId));

    // Save the task inside the archive folder
    await this.saveTask(archivedTaskPath, taskData);

    // Remove the original task
    await this.deleteTask(taskId, true);

    return taskId;
  }

  /**
   * Restore a task from the archive
   * @param {string} taskId The task id
   * @param {?string} [columnName=null] The column to restore the task to
   * @return {Promise<string>} The task id
   */
  async restoreTask(taskId, columnName = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    taskId = removeFileExtension(taskId);

    const archiveFolder = await this.getArchiveFolderPath();
    const archivedTaskPath = getTaskPath(archiveFolder, taskId);
    const taskPath = getTaskPath(await this.getTaskFolderPath(), taskId);

    // Make sure the archive folder exists
    if (!(await exists(archiveFolder))) {
      throw new Error("Archive folder doesn't exist");
    }

    // Make sure the task file exists in the archive
    if (!(await exists(archivedTaskPath))) {
      throw new Error(`No archived task found with id "${taskId}"`);
    }

    // Get index and make sure there isn't already an indexed task with the same id
    let index = await this.loadIndex();
    if (taskInIndex(index, taskId)) {
      throw new Error(`There is already an indexed task with id "${taskId}"`);
    }

    // Check if there is already a task with the same id
    if (await exists(taskPath)) {
      throw new Error(`There is already an untracked task with id "${taskId}"`);
    }

    // Make sure the index has some columns
    const columns = Object.keys(index.columns);
    if (columns.length === 0) {
      throw new Error('No columns defined in the index');
    }

    // Load the task from the archive
    let taskData = await this.loadArchivedTask(taskId);
    let actualColumnName = columnName || getTaskMetadata(taskData, "column") || columns[0];
    taskData = setTaskMetadata(taskData, "column", undefined);

    // Update task metadata dates and save task
    taskData = updateColumnLinkedCustomFields(index, taskData, actualColumnName);
    await this.saveTask(taskPath, taskData);

    // Add the task to the column and save the index
    index = addTaskToIndex(index, taskId, actualColumnName);
    await this.saveIndex(index);

    // Delete the archived task file
    await fs.promises.unlink(archivedTaskPath);

    return taskId;
  }

  /**
   * Nuke it from orbit, it's the only way to be sure
   */
  async removeAll() {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    rimraf.sync(await this.getMainFolder());
  }
};

module.exports.Kanbn = Kanbn
