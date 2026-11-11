const fs = require("fs");
const path = require("path");
const glob = require("glob-promise");

/**
 * List the markdown files directly inside a folder. The folder is passed as cwd rather than built into
 * the pattern, because glob patterns only take forward slashes and a Windows path never matches
 * @param {string} folder The folder to look in
 * @return {Promise<string[]>} The paths of the markdown files, in the folder's own path format
 */
async function globMarkdown(folder) {
  return (await glob("*.md", { cwd: folder })).map((file) => path.join(folder, file));
}
const parseIndex = require("./parse-index");
const parseTask = require("./parse-task");
const utility = require("./utility");
const yaml = require("yamljs");
const humanizeDuration = require("humanize-duration");
const rimraf = require("rimraf");
const gitUser = require("./git-user");
const actions = require("./actions");
const fuzzy = require("fuzzy");

const DEFAULT_FOLDER_NAME = ".kanbn";
const DEFAULT_INDEX_FILE_NAME = "index.md";
const DEFAULT_TASKS_FOLDER_NAME = "tasks";
const DEFAULT_ARCHIVE_FOLDER_NAME = "archive";

// Slugs that always resolve to the main board, whatever the index file is called
const MAIN_BOARD_ALIASES = ["main", "default"];

// Options that describe the workspace rather than a single board. They are only ever read from the
// config file (or, when there isn't one, from the main board's front matter) - if one of these turns
// up in a secondary board's front matter it is ignored, and `kanbn validate` reports it
const WORKSPACE_SCOPED_OPTIONS = [
  "mainFolder",
  "indexFile",
  "taskFolder",
  "archiveFolder",
  "defaultBoard",
  "boards",
  "customFields",
  "contributors",
  "dateFormat",
  "defaultTaskWorkload",
  "taskWorkloadTags",
  "taskIdResolution",
];

// Options that a secondary board inherits from the main board's front matter. When there is no
// config file the main board's front matter is doing double duty - it holds the workspace options
// *and* the main board's own board-scoped ones - so only this allowlist propagates. Anything else
// there (startedColumns, hiddenColumns, views, custom field column linkages, ...) belongs to the
// main board alone, and a secondary board that wants it has to say so itself
const WORKSPACE_INHERITED_OPTIONS = [...WORKSPACE_SCOPED_OPTIONS, "sprints"];

// Keys inside the `boards` config option that aren't board slugs
const RESERVED_BOARDS_CONFIG_KEYS = ["exclude", "order"];

// History event types that belong to the task rather than to a board, so they count when replaying
// for any board. Archiving removes a task from every board, and progress is a property of the task
const BOARD_AGNOSTIC_EVENT_TYPES = ["progress", "archived"];

// Date normalisation intervals measured in milliseconds
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// How loosely a partial task id is matched - see resolveTaskId()
const TASK_ID_RESOLUTION_MODES = ["exact", "prefix", "fuzzy"];
const DEFAULT_TASK_ID_RESOLUTION = "prefix";

// Shorter inputs than this are only ever matched exactly - "set" matching "setup-ci-pipeline" is
// technically unique but rarely what was meant
const MIN_PARTIAL_TASK_ID_LENGTH = 4;

// The most candidates an ambiguous task id error lists before summarising the rest
const MAX_AMBIGUOUS_TASK_IDS = 10;

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

// Metadata fields that hold a task's started and completed dates. Boards can override these with the
// startedField and completedField options, so that a task shared between several boards can carry
// separate started/completed state for each of them
const DEFAULT_STARTED_FIELD = "started";
const DEFAULT_COMPLETED_FIELD = "completed";
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
 * Convert a board file name into a board slug, i.e. "design.md" -> "design"
 * @param {string} fileName The board file name
 * @return {string} The board slug
 */
function boardSlugFromFileName(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

/**
 * Copy an object, leaving out the specified keys
 * @param {object} o The object to copy
 * @param {string[]} keys The keys to leave out
 * @return {object} A copy of the object without the specified keys
 */
function omitKeys(o, keys) {
  return Object.fromEntries(Object.entries(o).filter(([key]) => keys.indexOf(key) === -1));
}

/**
 * Record which options belong to a board's own front matter, so that saving the board writes exactly
 * these rather than everything it inherited from the workspace
 * @param {object} index The index object
 * @param {object} ownOptions The options that belong to this board
 * @return {object} The index object
 */
function setOwnOptions(index, ownOptions) {
  Object.defineProperty(index, "ownOptions", {
    value: { ...ownOptions },
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return index;
}

/**
 * Compare two option values structurally, so that an option inherited from the workspace can be told
 * apart from one that a board operation has actually changed
 * @param {any} a
 * @param {any} b
 * @return {boolean} True if the two values are equivalent
 */
function sameOptionValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
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
 * Check whether a preserved column content entry is a simple task: a single-line list item, rather
 * than a block of prose or an empty line. Only these can be addressed from the CLI
 * @param {object} entry A column content entry
 * @return {boolean} True if the entry is a simple task
 */
function isSimpleTask(entry) {
  return !entry.block && !!entry.text && entry.text.indexOf("\n") === -1;
}

/**
 * Remove a preserved column content entry from a column. Positions are unique within a column, so
 * they identify an entry
 * @param {object} index The index object
 * @param {string} columnName The column to remove from
 * @param {number} position The entry's position
 * @return {object} The modified index object
 */
function removeColumnContent(index, columnName, position) {
  if (!index.columnContent || !(columnName in index.columnContent)) {
    return index;
  }
  index.columnContent[columnName] = index.columnContent[columnName].filter(
    (entry) => entry.position !== position
  );
  if (!index.columnContent[columnName].length) {
    delete index.columnContent[columnName];
  }
  if (!Object.keys(index.columnContent).length) {
    delete index.columnContent;
  }
  return index;
}

/**
 * Add a preserved column content entry to a column
 * @param {object} index The index object
 * @param {string} columnName The column to add to
 * @param {object} entry The entry to add
 * @param {?number} [position=null] The position to add it at, or the end of the column if null
 * @return {object} The modified index object
 */
function addColumnContent(index, columnName, entry, position = null) {
  if (!index.columnContent) {
    index.columnContent = {};
  }
  if (!(columnName in index.columnContent)) {
    index.columnContent[columnName] = [];
  }

  // A position counts every entry in the column, tasks and content alike, so the end of the column
  // is past both of them
  const columnLength = index.columns[columnName].length + index.columnContent[columnName].length;
  index.columnContent[columnName].push({
    ...entry,
    position: position === null ? columnLength : Math.max(Math.min(position, columnLength), 0),
  });
  return index;
}

/**
 * Check whether a line in a column looks like a task link with a typo in it, e.g. a missing closing
 * bracket. A checkbox item (`- [ ] ...`) is an ordinary line rather than a broken link
 * @param {string} raw The raw line
 * @return {boolean} True if the line looks like a malformed task link
 */
function looksLikeMalformedTaskLink(raw) {
  const text = String(raw).replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
  return /^\[/.test(text) && !/^\[[ xX]\]/.test(text);
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
 * Work out which fields an update actually changed
 *
 * Reserved fields are left out: `updated` changes on every update, so including it would make the
 * payload say nothing
 * @param {object} before The task before the update
 * @param {object} after The task after it
 * @return {string[]} The names of the fields that changed
 */
function changedFields(before, after) {
  const fields = new Set();
  if (before.name !== after.name) {
    fields.add("name");
  }
  if (before.description !== after.description) {
    fields.add("description");
  }
  const beforeMetadata = before.metadata || {};
  const afterMetadata = after.metadata || {};
  for (const field of new Set([...Object.keys(beforeMetadata), ...Object.keys(afterMetadata)])) {
    if (actions.RESERVED_FIELDS.indexOf(field) !== -1) {
      continue;
    }
    if (JSON.stringify(beforeMetadata[field]) !== JSON.stringify(afterMetadata[field])) {
      fields.add(field);
    }
  }
  return [...fields];
}

/**
 * Normalise a contributors option into a consistent object form
 *
 * A contributor can be written as a bare name or as an object, and both mean the same thing - the
 * shorthand is what most workspaces will ever need, and requiring `- name: gordon` for a bare name
 * is the kind of ceremony that stops an optional feature being adopted. Everything downstream sees
 * the object form
 * @param {any} contributors The raw contributors option
 * @return {object[]} The normalised contributors
 */
function normaliseContributors(contributors) {
  if (!Array.isArray(contributors)) {
    return [];
  }
  const result = [];
  for (const contributor of contributors) {
    const source = typeof contributor === "string" ? { name: contributor } : contributor;
    if (source === null || typeof source !== "object" || typeof source.name !== "string") {
      continue;
    }
    const name = source.name.trim();
    if (!name) {
      continue;
    }
    const normalised = {
      name,
      displayName: typeof source.displayName === "string" && source.displayName ? source.displayName : name,
      aliases: Array.isArray(source.aliases)
        ? source.aliases.filter((alias) => typeof alias === "string" && alias.trim()).map((alias) => alias.trim())
        : [],
    };
    if (typeof source.email === "string" && source.email) {
      normalised.email = source.email;
    }

    // Purely presentational, for avatar chips in a UI. Kanbn stores and serves it, and never
    // interprets it
    if (typeof source.colour === "string" && source.colour) {
      normalised.colour = source.colour;
    }
    result.push(normalised);
  }
  return result;
}

/**
 * Find the contributor a value refers to, matching against the canonical name, the display name and
 * any aliases, case-insensitively
 * @param {object[]} contributors Normalised contributors
 * @param {?string} value The value to look up
 * @return {?object} The matching contributor, or null if there isn't one
 */
function matchContributor(contributors, value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const needle = value.trim().toLowerCase();
  return (
    contributors.find(
      (contributor) =>
        contributor.name.toLowerCase() === needle ||
        contributor.displayName.toLowerCase() === needle ||
        contributor.aliases.some((alias) => alias.toLowerCase() === needle)
    ) || null
  );
}

/**
 * Find the contributor with a given email address, case-insensitively
 * @param {object[]} contributors Normalised contributors
 * @param {?string} email The email address to look up
 * @return {?object} The matching contributor, or null if there isn't one
 */
function matchContributorEmail(contributors, email) {
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }
  const needle = email.trim().toLowerCase();
  return contributors.find((contributor) => (contributor.email || "").toLowerCase() === needle) || null;
}

/**
 * Append a structured history event to a task
 * @param {object} taskData The task object
 * @param {object} historyEvent The history event payload
 * @param {?string} [boardSlug=null] The board the event happened on, or null for the main board
 * @param {?string} [author=null] The user the event is attributed to, or null for no attribution
 * @return {object} The modified task object
 */
function appendTaskHistory(taskData, historyEvent, boardSlug = null, author = null) {
  if (!('history' in taskData) || taskData.history === null) {
    taskData.history = [];
  }
  taskData.history.push({
    date: new Date(),
    ...historyEvent,

    // Events on the main board carry no board key, so a single-board workspace writes exactly the
    // history it always has
    ...(boardSlug === null ? {} : { board: boardSlug }),

    // Likewise, a machine with no resolvable user writes no author key at all
    ...(author ? { author } : {})
  });
  return taskData;
}

/**
 * Get the name of the metadata field that holds a task's started date for this board. Boards can
 * point this at a custom date field so that several boards can track their own started/completed
 * state against the same shared task file
 * @param {object} index The index object
 * @return {string} The metadata field name
 */
function getStartedField(index) {
  return ("startedField" in index.options && index.options.startedField) || DEFAULT_STARTED_FIELD;
}

/**
 * Get the name of the metadata field that holds a task's completed date for this board
 * @param {object} index The index object
 * @return {string} The metadata field name
 */
function getCompletedField(index) {
  return ("completedField" in index.options && index.options.completedField) || DEFAULT_COMPLETED_FIELD;
}

/**
 * Find the column a task is currently in
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {?string} The column name, or null if the task isn't in the index
 */
function getTaskColumn(index, task) {
  return findTaskColumn(index, task.id || utility.getTaskId(task.name));
}

/**
 * Check if a task has been started, based on its metadata
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {boolean} True if the task has a started date
 */
function taskStarted(index, task) {
  return getStartedField(index) in task.metadata;
}

/**
 * Check if a task is completed, based on its metadata
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {boolean} True if the task has a completed date
 */
function taskCompleted(index, task) {
  return getCompletedField(index) in task.metadata;
}

/**
 * Check if a task is in one of this board's started columns. A board that declares no
 * startedColumns has no notion of work in progress, so nothing is in a started column
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {boolean} True if the task is in a started column
 */
function taskInStartedColumn(index, task) {
  const startedColumns = "startedColumns" in index.options ? index.options.startedColumns : [];
  const column = getTaskColumn(index, task);
  return column !== null && startedColumns.indexOf(column) !== -1;
}

/**
 * Check if a task is in one of this board's completed columns
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {boolean} True if the task is in a completed column
 */
function taskInCompletedColumn(index, task) {
  const completedColumns = "completedColumns" in index.options ? index.options.completedColumns : [];
  const column = getTaskColumn(index, task);
  return column !== null && completedColumns.indexOf(column) !== -1;
}

/**
 * Check if a task is overdue - i.e. it has a due date in the past and hasn't been completed. A task
 * with no due date is never overdue, and neither is a completed task, however late it was
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {boolean} True if the task is overdue
 */
function taskOverdue(index, task) {
  if (!("due" in task.metadata) || taskCompleted(index, task)) {
    return false;
  }
  return new Date() - task.metadata.due > 0;
}

/**
 * Flatten a task's metadata and computed values into a single object that can be used for sorting
 * @param {object} index The index object
 * @param {object} task The task object
 * @return {object} An object containing all sortable task fields
 */
function taskSortFields(index, task) {
  return {
    ...task,
    ...task.metadata,
    created: "created" in task.metadata ? task.metadata.created : "",
    updated: "updated" in task.metadata ? task.metadata.updated : "",
    started: "started" in task.metadata ? task.metadata.started : "",
    completed: "completed" in task.metadata ? task.metadata.completed : "",
    due: "due" in task.metadata ? task.metadata.due : "",
    plannedStart: "plannedStart" in task.metadata ? task.metadata.plannedStart : "",
    plannedFinish: "plannedFinish" in task.metadata ? task.metadata.plannedFinish : "",
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
    column: getTaskColumn(index, task) || "",
    overdue: taskOverdue(index, task),
    isStarted: taskStarted(index, task),
    isCompleted: taskCompleted(index, task),
    inStartedColumn: taskInStartedColumn(index, task),
    inCompletedColumn: taskInCompletedColumn(index, task),
  };
}

/**
 * Sort a list of tasks without modifying them, using each task's flattened sort fields
 * @param {object} index The index object
 * @param {object[]} tasks
 * @param {object[]} sorters
 * @return {object[]} The sorted tasks
 */
function sortTasksWithFields(index, tasks, sorters) {
  if (!sorters.length) {
    return tasks;
  }
  return sortTasks(
    tasks.map((task) => ({ task, fields: taskSortFields(index, task) })),
    sorters,
    (entry, field) => entry.fields[field]
  ).map((entry) => entry.task);
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
  // Sort the tasks in the target column using their flattened sort fields
  tasks = sortTasksWithFields(index, tasks, sorters);

  // Save the list of tasks back to the index. A task whose file is missing can't be loaded, so it
  // isn't in the sorted list - keep it in the column rather than dropping it from the board
  const sortedTaskIds = tasks.map((task) => task.id);
  const unsortedTaskIds = index.columns[columnName].filter((taskId) => sortedTaskIds.indexOf(taskId) === -1);
  index.columns[columnName] = [...sortedTaskIds, ...unsortedTaskIds];
  return index;
}

/**
 * Sort a list of tasks
 * @param {object[]} tasks
 * @param {object[]} sorters
 * @param {?function} [getField=null] An optional accessor used to read a sort field from a task
 * @return {object[]} The sorted tasks
 */
function sortTasks(tasks, sorters, getField = null) {
  const readField = getField || ((task, field) => task[field]);
  tasks.sort((a, b) => {
    let compareA, compareB;
    for (let sorter of sorters) {
      compareA = readField(a, sorter.field);
      compareB = readField(b, sorter.field);
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
    const taskId = task.id;
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

    // Planned start date
    if (
      "plannedStart" in filters &&
      (!("plannedStart" in task.metadata) || !dateFilter(filters.plannedStart, task.metadata.plannedStart))
    ) {
      result = false;
    }

    // Planned finish date
    if (
      "plannedFinish" in filters &&
      (!("plannedFinish" in task.metadata) || !dateFilter(filters.plannedFinish, task.metadata.plannedFinish))
    ) {
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

    // Overdue
    if ("overdue" in filters && !booleanFilter(filters.overdue, taskOverdue(index, task))) {
      result = false;
    }

    // Started, from the task's metadata
    if ("is-started" in filters && !booleanFilter(filters["is-started"], taskStarted(index, task))) {
      result = false;
    }

    // Completed, from the task's metadata
    if ("is-completed" in filters && !booleanFilter(filters["is-completed"], taskCompleted(index, task))) {
      result = false;
    }

    // In a started column on this board
    if (
      "in-started-column" in filters &&
      !booleanFilter(filters["in-started-column"], taskInStartedColumn(index, task))
    ) {
      result = false;
    }

    // In a completed column on this board
    if (
      "in-completed-column" in filters &&
      !booleanFilter(filters["in-completed-column"], taskInCompletedColumn(index, task))
    ) {
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
    if ("tag" in filters && !stringFilter(filters.tag, ("tags" in task.metadata ? task.metadata.tags : []).join("\n"))) {
      result = false;
    }

    // Count tags
    if (
      "count-tags" in filters &&
      !numberFilter(filters["count-tags"], ("tags" in task.metadata ? task.metadata.tags : []).length)
    ) {
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
 * Check if the input matches a boolean, or if multiple booleans are passed in, check if the input
 * matches any of them
 * @param {boolean|boolean[]} filter A filter boolean or array of filter booleans
 * @param {boolean} input The value to match against
 * @return {boolean} True if the input matches the boolean filter
 */
function booleanFilter(filter, input) {
  return utility.arrayArg(filter).some((value) => !!value === !!input);
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
 * Find the date at which a task most recently entered one of the specified columns, using its
 * history. Returns null if the task has no history, or none of its events mention those columns
 * @param {object} task
 * @param {string[]} columnNames
 * @return {?Date}
 */
function findColumnEntryDate(task, columnNames) {
  if (!("history" in task) || !Array.isArray(task.history) || task.history.length === 0) {
    return null;
  }
  let result = null;
  for (const historyEvent of [...task.history].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (!historyEvent.date) {
      continue;
    }
    const enteredColumn = historyEvent.type === "moved"
      ? historyEvent.toColumn
      : (historyEvent.type === "created" || historyEvent.type === "restored")
        ? (historyEvent.column || historyEvent.toColumn)
        : null;
    if (enteredColumn && columnNames.indexOf(enteredColumn) !== -1) {
      result = historyEvent.date;
    }
  }
  return result;
}

/**
 * Get task progress at a specific date from history when available
 * @param {object} task
 * @param {Date} date
 * @return {number}
 */
function getTaskProgressAtDate(task, date) {
  if ("history" in task && Array.isArray(task.history) && task.history.length > 0) {
    let progress = 0;
    const history = [...task.history].sort((a, b) => a.date.getTime() - b.date.getTime());
    history.forEach((historyEvent) => {
      if (!historyEvent.date || historyEvent.date > date) {
        return;
      }
      if (historyEvent.type === 'progress' && historyEvent.toProgress !== undefined) {
        progress = historyEvent.toProgress;
      }
      if (historyEvent.type === 'created' && historyEvent.toProgress !== undefined) {
        progress = historyEvent.toProgress;
      }
    });
    return Math.max(0, Math.min(progress, 1));
  }
  if (task.completed && task.completed <= date) {
    return 1;
  }
  const progress = "progress" in task.metadata ? task.metadata.progress : 0;
  return Math.max(0, Math.min(progress, 1));
}

/**
 * Check whether a history event counts when replaying for a board. An event belongs to a board if it
 * names that board, or if it names none and we're replaying for the main board - which is exactly
 * what makes every task file written before boards existed replay the way it always has
 * @param {object} historyEvent The history event
 * @param {?string} [boardSlug=null] The board being replayed for, or null for the main board
 * @return {boolean} True if the event counts for this board
 */
function historyEventOnBoard(historyEvent, boardSlug = null) {
  if (BOARD_AGNOSTIC_EVENT_TYPES.indexOf(historyEvent.type) !== -1) {
    return true;
  }
  if ("board" in historyEvent && historyEvent.board) {
    return historyEvent.board === boardSlug;
  }
  return boardSlug === null;
}

/**
 * Get timeline dates for a task in a period. For history-enabled tasks this uses all history event dates,
 * otherwise it falls back to created/started/completed dates.
 * @param {object} task
 * @param {Date} from
 * @param {Date} to
 * @param {?string} [boardSlug=null] The board to replay for, or null for the main board
 * @return {Date[]}
 */
function getTaskTimelineDates(task, from, to, boardSlug = null) {
  if ("history" in task && Array.isArray(task.history) && task.history.length > 0) {
    return task.history
      .filter((historyEvent) => historyEventOnBoard(historyEvent, boardSlug))
      .map((historyEvent) => historyEvent.date)
      .filter((date) => date && date >= from && date <= to);
  }
  return [task.created, task.started, task.completed].filter((date) => date && date >= from && date <= to);
}

/**
 * Normalise relation type text to kebab-case
 * @param {string} relationType
 * @return {string}
 */
function normaliseRelationType(relationType) {
  return String(relationType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Get the earliest date in a list of dates
 * @param {Date[]} dates
 * @return {?Date}
 */
function minDate(dates) {
  const filteredDates = dates.filter((date) => date instanceof Date);
  if (filteredDates.length === 0) {
    return null;
  }
  return new Date(Math.min(...filteredDates.map((date) => date.getTime())));
}

/**
 * Get the latest date in a list of dates
 * @param {Date[]} dates
 * @return {?Date}
 */
function maxDate(dates) {
  const filteredDates = dates.filter((date) => date instanceof Date);
  if (filteredDates.length === 0) {
    return null;
  }
  return new Date(Math.max(...filteredDates.map((date) => date.getTime())));
}

/**
 * Set a date to the start of the day
 * @param {Date} date
 * @return {Date}
 */
function startOfDay(date) {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Set a date to the end of the day
 * @param {Date} date
 * @return {Date}
 */
function endOfDay(date) {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the task anchor date used for gantt ordering
 * @param {object} task
 * @return {Date}
 */
function getTaskGanttAnchor(task) {
  return minDate([
    task.metadata.plannedStart,
    task.created,
    task.started,
    task.metadata.plannedFinish,
    task.completed
  ]) || new Date(0);
}

/**
 * Find one concrete dependency cycle in the graph, if present
 * @param {Map<string, Set<string>>} dependencyMap
 * @return {string[]}
 */
function findDependencyCycle(dependencyMap) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  let cycleTaskIds = [];

  const visit = (taskId) => {
    if (cycleTaskIds.length) {
      return;
    }

    visiting.add(taskId);
    stack.push(taskId);

    for (let dependencyId of dependencyMap.get(taskId) || []) {
      if (!visited.has(dependencyId) && !visiting.has(dependencyId)) {
        visit(dependencyId);
        if (cycleTaskIds.length) {
          return;
        }
      } else if (visiting.has(dependencyId)) {
        const cycleStartIndex = stack.indexOf(dependencyId);
        cycleTaskIds = stack.slice(cycleStartIndex).concat(dependencyId);
        return;
      }
    }

    stack.pop();
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (let taskId of dependencyMap.keys()) {
    if (!visited.has(taskId)) {
      visit(taskId);
      if (cycleTaskIds.length) {
        break;
      }
    }
  }

  return cycleTaskIds;
}

/**
 * Build gantt schedule data from tracked tasks
 * @param {object} index
 * @param {object[]} tasks
 * @param {Date} now
 * @return {object}
 */
function buildGanttSchedule(index, tasks, now, trackedTaskIds = new Set()) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dependencyMap = new Map(tasks.map((task) => [task.id, new Set()]));
  const dependentsMap = new Map();
  const indegree = new Map(tasks.map((task) => [task.id, 0]));
  const externalIncomingDependenciesMap = new Map(tasks.map((task) => [task.id, new Set()]));
  const externalOutgoingDependentsMap = new Map(tasks.map((task) => [task.id, new Set()]));

  const taskExistsInBoard = (taskId) => trackedTaskIds.has(taskId);

  const addDependencyEdge = (dependencyId, dependentId) => {
    if (!taskById.has(dependentId)) {
      throw new Error(`Task "${dependentId}" depends on missing task "${dependencyId}"`);
    }

    if (!taskById.has(dependencyId)) {
      if (taskExistsInBoard(dependencyId)) {
        externalIncomingDependenciesMap.get(dependentId).add(dependencyId);
      }

      // A dependency that isn't on this board at all - archived, only on another board, or deleted -
      // has nothing to schedule against, so it doesn't hold the dependent back. Archiving a finished
      // blocker is routine, and validate reports the relations that point at nothing
      return;
    }

    const dependencies = dependencyMap.get(dependentId);
    if (dependencies.has(dependencyId)) {
      return;
    }

    dependencies.add(dependencyId);
    indegree.set(dependentId, indegree.get(dependentId) + 1);
    if (!dependentsMap.has(dependencyId)) {
      dependentsMap.set(dependencyId, []);
    }
    dependentsMap.get(dependencyId).push(dependentId);
  };

  tasks.forEach((task) => {
    (Array.isArray(task.relations) ? task.relations : []).forEach((relation) => {
      if (!relation || !relation.task) {
        return;
      }

      const relationType = normaliseRelationType(relation.type);
      if (relationType === 'depends-on') {
        addDependencyEdge(relation.task, task.id);
      } else if (relationType === 'blocks') {
        if (taskById.has(relation.task)) {
          addDependencyEdge(task.id, relation.task);
        } else if (taskExistsInBoard(relation.task)) {
          externalOutgoingDependentsMap.get(task.id).add(relation.task);
        }
      }
    });
  });

  const queue = tasks
    .filter((task) => indegree.get(task.id) === 0)
    .slice()
    .sort((a, b) => compareValues(getTaskGanttAnchor(a), getTaskGanttAnchor(b)) || compareValues(a.id, b.id));
  const orderedTasks = [];

  while (queue.length > 0) {
    const nextTask = queue.shift();
    orderedTasks.push(nextTask);

    for (let dependentId of dependentsMap.get(nextTask.id) || []) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);
      if (indegree.get(dependentId) === 0) {
        queue.push(taskById.get(dependentId));
        queue.sort((a, b) => compareValues(getTaskGanttAnchor(a), getTaskGanttAnchor(b)) || compareValues(a.id, b.id));
      }
    }
  }

  let dependencyCycleDetected = false;
  let cycleFallbackTaskIds = [];
  let dependencyCycleTaskIds = [];
  if (orderedTasks.length !== tasks.length) {
    dependencyCycleDetected = true;
    dependencyCycleTaskIds = findDependencyCycle(dependencyMap);
    const orderedTaskIds = new Set(orderedTasks.map((task) => task.id));
    const remainingTasks = tasks
      .filter((task) => !orderedTaskIds.has(task.id))
      .slice()
      .sort((a, b) => compareValues(getTaskGanttAnchor(a), getTaskGanttAnchor(b)) || compareValues(a.id, b.id));
    cycleFallbackTaskIds = remainingTasks.map((task) => task.id);
    orderedTasks.push(...remainingTasks);
  }

  const scheduledTasks = [];
  const scheduleById = new Map();
  for (let task of orderedTasks) {
    const dependencies = [...(dependencyMap.get(task.id) || [])];
    const dependencyEnd = maxDate(
      dependencies
        .map((dependencyId) => scheduleById.get(dependencyId))
        .filter((scheduledDependency) => scheduledDependency)
        .map((scheduledDependency) => scheduledDependency.end)
    );
    const hasPlannedStart = task.metadata.plannedStart instanceof Date;
    const hasPlannedFinish = task.metadata.plannedFinish instanceof Date;
    const hasStarted = task.started instanceof Date;
    const hasCompleted = task.completed instanceof Date;

    const duration = hasPlannedStart && hasPlannedFinish
      ? Math.max(DAY, task.metadata.plannedFinish.getTime() - task.metadata.plannedStart.getTime())
      : hasStarted && hasCompleted
        ? Math.max(DAY, task.completed.getTime() - task.started.getTime())
        : Math.max(DAY, Math.ceil(Math.max(1, task.workload)) * DAY);

    const preferredStart = hasPlannedStart
      ? task.metadata.plannedStart
      : hasStarted
        ? task.started
        : task.created;
    const finishHint = hasPlannedFinish
      ? task.metadata.plannedFinish
      : hasCompleted
        ? task.completed
        : null;

    const derivedStartFromFinish = finishHint instanceof Date
      ? new Date(finishHint.getTime() - duration)
      : null;
    const taskBaseDate = hasPlannedStart || hasStarted
      ? preferredStart
      : (derivedStartFromFinish || preferredStart);

    const scheduleAnchor = maxDate([
      taskBaseDate,
      dependencyEnd
    ]) || new Date(0);

    let start = new Date(scheduleAnchor.getTime());
    let end = hasPlannedFinish
      ? new Date(task.metadata.plannedFinish.getTime())
      : hasCompleted
        ? new Date(task.completed.getTime())
        : new Date(start.getTime() + duration);

    if (end.getTime() < start.getTime()) {
      end = new Date(start.getTime() + duration);
    }

    const scheduledTask = {
      ...task,
      dependencies,
      externalIncomingDependencies: [...(externalIncomingDependenciesMap.get(task.id) || [])],
      externalOutgoingDependents: [...(externalOutgoingDependentsMap.get(task.id) || [])],
      start,
      end,
      blocked: dependencyEnd !== null && preferredStart instanceof Date && dependencyEnd.getTime() > preferredStart.getTime()
    };
    scheduleById.set(task.id, scheduledTask);
    scheduledTasks.push(scheduledTask);
  }

  const from = startOfDay(minDate(scheduledTasks.map((task) => task.start)) || now);
  const to = endOfDay(maxDate(scheduledTasks.map((task) => task.end)) || now);

  return {
    from,
    to,
    dependencyCycleDetected,
    dependencyCycleTaskIds,
    cycleFallbackTaskIds,
    tasks: scheduledTasks
  };
}

/**
 * Get a list of tasks that were started before and/or completed after a date
 *
 * A task is active from its started date until its completed date. This used to be derived by
 * replaying the task's history to work out which column it was in at the time and comparing that
 * column against the index options, which meant a task's activity depended on column names rather
 * than on the dates recorded against it
 * @param {object} index
 * @param {object[]} tasks
 * @param {Date} date
 * @return {object[]} A filtered list of tasks
 */
function getActiveTasksAtDate(index, tasks, date) {
  return tasks.filter((task) => (
    (task.started !== false && task.started <= date) &&
    (task.completed === false || task.completed > date)
  ));
}

/**
 * Calculate the total workload at a specific date
 * @param {object} index
 * @param {object[]} tasks
 * @param {Date} date
 * @return {number} The total workload at the specified date
 */
function getWorkloadAtDate(index, tasks, date) {
  return getActiveTasksAtDate(index, tasks, date).reduce((a, task) => {
    const progress = getTaskProgressAtDate(task, date);
    return a + task.workload * (1 - progress);
  }, 0);
}

/**
 * Get the number of tasks that were active at a specific date
 * @param {object} index
 * @param {object[]} tasks
 * @param {Date} date
 * @return {number} The total number of active tasks at the specified date
 */
function countActiveTasksAtDate(index, tasks, date) {
  return getActiveTasksAtDate(index, tasks, date).length;
}

/**
 * Get a list of tasks that were started or completed on a specific date
 * @param {object} index
 * @param {object[]} tasks
 * @param {Date} date
 * @param {?string} [boardSlug=null] The board to replay for, or null for the main board
 * @return {object[]} A list of event objects, with event type and task id
 */
function getTaskEventsAtDate(index, tasks, date, boardSlug = null) {
  return tasks
    .map((task) => {
      if ("history" in task && Array.isArray(task.history) && task.history.length > 0) {
        return task.history
          .filter((historyEvent) => historyEventOnBoard(historyEvent, boardSlug))
          .filter((historyEvent) => historyEvent.date && historyEvent.date.getTime() === date.getTime())
          .map((historyEvent) => ({
            eventType: historyEvent.type,
            task
          }));
      }
      return [
        (task.created ? task.created.getTime() : 0) === date.getTime() && {
          eventType: "created",
          task
        },
        (task.started ? task.started.getTime() : 0) === date.getTime() && {
          eventType: "started",
          task
        },
        (task.completed ? task.completed.getTime() : 0) === date.getTime() && {
          eventType: "completed",
          task
        }
      ].filter((event) => !!event);
    })
    .flat();
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
 * @param {Date} [date=new Date()] The date to stamp
 * @return {object} The updated task data
 */
function updateColumnLinkedCustomFields(index, taskData, columnName, date = new Date()) {
  // Update built-in column-linked metadata properties first (started and completed dates). The
  // columns are always listed in startedColumns/completedColumns, but the field that gets written
  // can be pointed elsewhere with startedField/completedField
  taskData = updateColumnLinkedCustomField(
    index, taskData, columnName, getCompletedField(index), "once", "completedColumns", date
  );
  taskData = updateColumnLinkedCustomField(
    index, taskData, columnName, getStartedField(index), "once", "startedColumns", date
  );

  // Update column-linked custom fields
  if ("customFields" in index.options) {
    for (let customField of index.options.customFields) {
      if (customField.type === "date") {
        taskData = updateColumnLinkedCustomField(
          index,
          taskData,
          columnName,
          customField.name,
          customField.updateDate || "none",
          null,
          date
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
 * @param {?string} [columnListName=null] The option holding the linked column names, or null to use
 * the `${fieldName}Columns` convention
 * @param {Date} [date=new Date()] The date to stamp
 */
function updateColumnLinkedCustomField(
  index, taskData, columnName, fieldName, updateCriteria = "none", columnListName = null,
  date = new Date()
) {
  const columnList = columnListName || `${fieldName}Columns`;
  if (columnList in index.options && index.options[columnList].indexOf(columnName) !== -1) {
    switch (updateCriteria) {
      case "always":
        taskData = setTaskMetadata(taskData, fieldName, date);
        break;
      case "once":
        if (!(fieldName in taskData.metadata && taskData.metadata[fieldName])) {
          taskData = setTaskMetadata(taskData, fieldName, date);
        }
        break;
      default:
        break;
    }
  }
  return taskData;
}

// The parts of this module the actions engine needs. Passing them in rather than requiring main.js
// from actions.js keeps the engine free of filesystem and workspace knowledge, and free of a
// circular require
const ACTION_HELPERS = {
  filterTasks,
  getTaskMetadata,
  setTaskMetadata,
  appendTaskHistory
};

class Kanbn {
  ROOT = process.cwd();
  CONFIG_YAML = path.join(this.ROOT, "kanbn.yml");
  CONFIG_JSON = path.join(this.ROOT, "kanbn.json");

  // The board this instance is scoped to, or null for the main board
  boardSlug = null;

  // Boards named in an archived task's metadata that no longer existed when it was restored, set by
  // restoreTask() for the caller to report
  lastRestoreWarnings = [];

  // Rules that were skipped during the last operation, set by runActions() for the caller to report
  lastActionWarnings = [];

  // Whether scripted actions run for operations on this instance. Actions are ordinary declarative
  // rules with no code execution, so this is a convenience for stepping around a misbehaving rule
  // rather than a safety control
  actionsEnabled = true;

  /**
   * @param {?string} [root=null] The workspace root folder
   * @param {object} [options={}] Instance options: `board` scopes this instance to a board, `caches`
   * lets a board-scoped clone share its parent's memoized config
   */
  constructor(root = null, options = {}) {
    if(root) {
      this.ROOT = root
      this.CONFIG_YAML = path.join(this.ROOT, "kanbn.yml");
      this.CONFIG_JSON = path.join(this.ROOT, "kanbn.json");
    }
    this.caches = options.caches || { config: null, workspaceOptions: null };
    this.boardSlug = options.board || null;
    if (options.actions === false) {
      this.actionsEnabled = false;
    }
  }

  // Memoized config, kept in the shared cache object so that board-scoped clones don't each re-read it
  get configMemo() {
    return this.caches.config;
  }

  set configMemo(value) {
    this.caches.config = value;
  }

  /**
   * Get a copy of this instance scoped to another board. The returned instance shares this one's
   * cached config, so scoping to a board costs no extra file reads
   * @param {?string} [slug=null] The board slug, or null/"main"/"default" for the main board
   * @return {Kanbn} A board-scoped Kanbn instance
   */
  board(slug = null) {
    if (slug === null || slug === undefined || slug === "") {
      return this.boardSlug === null
        ? this
        : new Kanbn(this.ROOT, { caches: this.caches, actions: this.actionsEnabled });
    }
    return new Kanbn(this.ROOT, {
      board: String(slug).trim(),
      caches: this.caches,
      actions: this.actionsEnabled
    });
  }

  /**
   * Get an instance that runs no actions
   *
   * Used for the writes one operation makes on another's behalf - archiving removes the task from
   * every board, and that removal is part of the archive, not a deletion anyone wrote a rule for
   * @return {Kanbn} An instance with actions disabled
   */
  withoutActions() {
    if (!this.actionsEnabled) {
      return this;
    }
    return new Kanbn(this.ROOT, { board: this.boardSlug, caches: this.caches, actions: false });
  }

  /**
   * Alias for board()
   * @param {?string} [slug=null] The board slug
   * @return {Kanbn} A board-scoped Kanbn instance
   */
  withBoard(slug = null) {
    return this.board(slug);
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
    this.caches.workspaceOptions = null;
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
    this.caches.config = null;
    this.caches.workspaceOptions = null;
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
   * Get the main board's slug. This is the index file name without its extension, so a workspace with
   * a customised `indexFile` gets a main board slug to match
   * @return {Promise<string>} The main board slug
   */
  async getMainBoardSlug() {
    return boardSlugFromFileName(await this.getIndexFileName());
  }

  /**
   * Resolve a board slug, mapping the reserved aliases and an absent slug onto the main board
   * @param {?string} [slug=undefined] The board slug, defaulting to this instance's board
   * @return {Promise<string>} The resolved board slug
   */
  async resolveBoardSlug(slug = undefined) {
    if (slug === undefined) {
      slug = this.boardSlug;
    }
    const mainBoardSlug = await this.getMainBoardSlug();
    if (slug === null || slug === undefined || slug === "") {
      return mainBoardSlug;
    }
    slug = String(slug).trim();
    if (MAIN_BOARD_ALIASES.indexOf(slug.toLowerCase()) !== -1) {
      return mainBoardSlug;
    }
    return slug;
  }

  /**
   * Check if a slug refers to the main board
   * @param {?string} [slug=undefined] The board slug, defaulting to this instance's board
   * @return {Promise<boolean>} True if the slug refers to the main board
   */
  async isMainBoard(slug = undefined) {
    return (await this.resolveBoardSlug(slug)) === (await this.getMainBoardSlug());
  }

  /**
   * Get the file path for a board. The main board keeps its configured index file name, every other
   * board is a sibling markdown file named after its slug
   * @param {?string} [slug=undefined] The board slug, defaulting to this instance's board
   * @return {Promise<string>} The board file path
   */
  async getBoardPath(slug = undefined) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    const mainFolder = await this.getMainFolder();
    if (resolvedSlug === (await this.getMainBoardSlug())) {
      return path.join(mainFolder, await this.getIndexFileName());
    }
    return path.join(mainFolder, `${resolvedSlug}.md`);
  }

  /**
   * Get the index path. This is the path of the board this instance is scoped to
   * @return {Promise<string>} The kanbn index path
   */
  async getIndexPath() {
    return this.getBoardPath();
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
    await this.taskExists(taskId);
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

      const completedField = getCompletedField(index);
      const completedDate = completedField in task.metadata ? task.metadata[completedField] : null;

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
      dueData.overdue = taskOverdue(index, task);
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
    return sortTasksWithFields(index, filterTasks(index, tasks, filters), sorters);
  }

  /**
   * Get the workspace-scoped options. These live in the config file if there is one, and in the main
   * board's front matter if there isn't - which means loading a secondary board also means reading the
   * main board. The result is memoized so that costs one extra file read per process, not per board
   * @return {Promise<object>} The workspace options
   */
  async getWorkspaceOptions() {
    return (await this.loadWorkspaceOptions()).options;
  }

  /**
   * Load the workspace options along with where they came from, since that decides how much of them
   * a secondary board inherits
   * @return {Promise<{options: object, fromConfig: boolean}>} The workspace options and their source
   */
  async loadWorkspaceOptions() {
    if (this.caches.workspaceOptions === null) {
      const config = await this.getConfig();
      if (config !== null) {
        this.caches.workspaceOptions = { options: { ...config }, fromConfig: true };
      } else {
        let options = {};
        try {
          const mainBoardData = await fs.promises.readFile(
            await this.getBoardPath(await this.getMainBoardSlug()),
            { encoding: "utf-8" }
          );
          options = parseIndex.md2json(mainBoardData).options;
        } catch (error) {
          // A missing or unparseable main board leaves secondary boards with defaults only. This is
          // reported by validate rather than thrown, so that one broken file doesn't break every board
          options = {};
        }
        this.caches.workspaceOptions = { options, fromConfig: false };
      }
    }
    return this.caches.workspaceOptions;
  }

  /**
   * Normalise a contributors option into a consistent object form. Exposed so that callers holding
   * an index object (the VSCode extension, for one) don't have to reimplement the shorthand rules
   * @param {any} contributors The raw contributors option
   * @return {object[]} The normalised contributors
   */
  normaliseContributors(contributors) {
    return normaliseContributors(contributors);
  }

  /**
   * Get the workspace's contributors, normalised to the object form
   *
   * Contributors are advisory: they're a convenience list, not an access control list, and nothing
   * anywhere validates `assigned` or a comment `author` against them
   * @return {Promise<object[]>} The normalised contributors, or an empty array if none are declared
   */
  async getContributors() {
    return normaliseContributors((await this.getWorkspaceOptions()).contributors);
  }

  /**
   * Find the contributor a value refers to, matching against the canonical name, the display name
   * and any aliases, case-insensitively
   * @param {?string} value The value to look up
   * @return {Promise<?object>} The matching contributor, or null if there isn't one
   */
  async findContributor(value) {
    return matchContributor(await this.getContributors(), value);
  }

  /**
   * Work out who the current user is, as the value that would be written into `assigned` or a
   * comment `author`
   *
   * In order, first match wins:
   *  1. the KANBN_USER environment variable, used verbatim
   *  2. `git config user.email` matched against a contributor's email
   *  3. `git config user.name` matched against a contributor's name, display name or aliases
   *  4. `git config user.name` as-is
   *  5. null
   *
   * With no contributors declared this is exactly what the git username has always been, so a
   * workspace that ignores contributors sees no change. With contributors declared it canonicalises:
   * a machine whose git says "Gordon Larrigan" writes "gordon", because that's what the workspace has
   * agreed to call him
   * @return {Promise<?string>} The current user, or null if there's nothing to go on
   */
  async currentUser() {
    // An explicitly set user is used exactly as given - it's the escape hatch for a machine whose
    // git identity is wrong, or which has none
    const envUser = (process.env.KANBN_USER || "").trim();
    if (envUser) {
      return envUser;
    }

    const contributors = await this.getContributors();
    if (contributors.length) {
      const byEmail = matchContributorEmail(contributors, gitUser.email());
      if (byEmail !== null) {
        return byEmail.name;
      }
      const byName = matchContributor(contributors, gitUser.name());
      if (byName !== null) {
        return byName.name;
      }
    }
    return gitUser.name();
  }

  /**
   * Get the options a secondary board inherits from the workspace. A config file is workspace-level
   * by construction, so all of it is inherited; the main board's front matter is that board's own
   * file, so only the workspace-scoped keys in it are
   * @return {Promise<object>} The inherited options
   */
  async getInheritedBoardOptions() {
    const { options, fromConfig } = await this.loadWorkspaceOptions();
    if (fromConfig) {
      return { ...options };
    }
    return Object.fromEntries(
      Object.entries(options).filter(([key]) => WORKSPACE_INHERITED_OPTIONS.indexOf(key) !== -1)
    );
  }

  /**
   * Get the per-board options declared for a board in the config file's `boards` key, if any
   * @param {?string} [slug=undefined] The board slug, defaulting to this instance's board
   * @return {Promise<object>} The board's options from config, or an empty object
   */
  async getBoardConfig(slug = undefined) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    const config = await this.getConfig();
    if (config === null || typeof config.boards !== "object" || config.boards === null) {
      return {};
    }
    if (RESERVED_BOARDS_CONFIG_KEYS.indexOf(resolvedSlug) !== -1) {
      return {};
    }
    const boardConfig = config.boards[resolvedSlug];
    return typeof boardConfig === "object" && boardConfig !== null && !Array.isArray(boardConfig)
      ? { ...boardConfig }
      : {};
  }

  /**
   * Layer a board's own front matter options over the workspace options
   * @param {string} resolvedSlug The resolved board slug
   * @param {object} ownOptions The options taken from the board file's front matter
   * @return {Promise<object>} The resolved options
   */
  async resolveBoardOptions(resolvedSlug, ownOptions) {
    // The main board is where the workspace options live, so there is nothing to layer: this is
    // exactly the behaviour Kanbn has always had
    if (resolvedSlug === (await this.getMainBoardSlug())) {
      const config = await this.getConfig();
      return config !== null ? { ...ownOptions, ...config } : { ...ownOptions };
    }

    // Workspace-scoped keys in a secondary board's front matter are ignored - one task file has to
    // parse identically for every board that references it. validate reports them
    return {
      ...(await this.getInheritedBoardOptions()),
      ...(await this.getBoardConfig(resolvedSlug)),
      ...omitKeys(ownOptions, WORKSPACE_SCOPED_OPTIONS),
    };
  }

  /**
   * Work out which options belong in a secondary board's own front matter, so that options inherited
   * from the workspace aren't copied into every board file the first time it is saved
   * @param {string} resolvedSlug The resolved board slug
   * @param {object} indexData The board data being saved
   * @return {Promise<object>} The options to write to the board file's front matter
   */
  async getOwnBoardOptions(resolvedSlug, indexData) {
    const previousOwnOptions = indexData.ownOptions ? { ...indexData.ownOptions } : {};
    const inheritedOptions = {
      ...(await this.getInheritedBoardOptions()),
      ...(await this.getBoardConfig(resolvedSlug)),
    };
    const options = indexData.options || {};
    const ownOptions = { ...previousOwnOptions };
    for (const [key, value] of Object.entries(options)) {
      if (WORKSPACE_SCOPED_OPTIONS.indexOf(key) !== -1) {
        continue;
      }

      // Keep anything the board already declared, and pick up anything that differs from what the
      // workspace provides - i.e. anything this operation actually changed
      if (key in previousOwnOptions || !(key in inheritedOptions) || !sameOptionValue(inheritedOptions[key], value)) {
        ownOptions[key] = value;
      }
    }

    // Drop anything that has been removed from the board's options entirely
    for (const key of Object.keys(ownOptions)) {
      if (!(key in options)) {
        delete ownOptions[key];
      }
    }
    return ownOptions;
  }

  /**
   * Overwrite a board file with the specified data
   * @param {?string} slug The board slug, or null for the main board
   * @param {object} indexData Board data to save
   */
  async saveBoard(slug, indexData) {
    const resolvedSlug = await this.resolveBoardSlug(slug);

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

    const boardPath = await this.getBoardPath(resolvedSlug);
    if (resolvedSlug === (await this.getMainBoardSlug())) {

      // If there is a separate config file, save options to this file
      let ignoreOptions = false;
      if (await this.configExists()) {
        await this.saveConfig(indexData.options);
        ignoreOptions = true;
      }

      // The main board owns the workspace options, so any cached copy is now stale
      this.caches.workspaceOptions = null;
      await fs.promises.writeFile(boardPath, parseIndex.json2md(indexData, ignoreOptions));
      return;
    }

    // A secondary board's options always live in its own front matter, and workspace-scoped options
    // are never written to the config file as a side effect of a board-local operation
    const ownOptions = await this.getOwnBoardOptions(resolvedSlug, indexData);
    await fs.promises.writeFile(
      boardPath,
      parseIndex.json2md({ ...indexData, options: ownOptions }, false)
    );
  }

  /**
   * Load a board file and parse it to an object
   * @param {?string} [slug=undefined] The board slug, defaulting to this instance's board
   * @return {Promise<object>} The board object
   */
  async loadBoard(slug = undefined) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    const isMainBoard = resolvedSlug === (await this.getMainBoardSlug());
    let boardData = "";
    try {
      boardData = await fs.promises.readFile(await this.getBoardPath(resolvedSlug), { encoding: "utf-8" });
    } catch (error) {
      throw new Error(
        isMainBoard
          ? `Couldn't access index file: ${error.message}`
          : `Couldn't access board file for board "${resolvedSlug}": ${error.message}`
      );
    }
    const index = parseIndex.md2json(boardData);

    // Remember which options came from this board's own front matter, so that saving it again doesn't
    // persist everything it inherited from the workspace
    setOwnOptions(index, index.options);
    index.options = await this.resolveBoardOptions(resolvedSlug, index.options);
    return index;
  }

  /**
   * Overwrite the index file with the specified data
   * @param {object} indexData Index data to save
   */
  async saveIndex(indexData) {
    return this.saveBoard(this.boardSlug, indexData);
  }

  /**
   * Load the index file and parse it to an object
   * @return {Promise<object>} The index object
   */
  async loadIndex() {
    return this.loadBoard(this.boardSlug);
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

    // The parser can only derive an id from the task's name, which drifts from the file whenever the
    // name is edited by hand. The file is what the index links to, so it's the id that counts
    return { ...parseTask.md2json(taskData), id: removeFileExtension(taskId) };
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
      try {
        result.push(await this.loadTask(taskId));
      } catch (error) {

        // A board referencing a task file that doesn't exist is a broken reference, not a reason to
        // fail: it happens whenever a board file and a task file arrive in different commits. Skip
        // it and carry on - findMissingTaskFiles() and validate report it. Anything else (an
        // unreadable or unparseable file) still throws, because that is a file with contents that
        // can't be trusted rather than a file that isn't there
        if (!(await this.taskFileExists(taskId))) {
          continue;
        }
        throw error;
      }
    }
    return result;
  }

  /**
   * Find tasks that this board references but which have no task file
   * @param {?object} [index=null] The index object, or null to load it
   * @return {Promise<object[]>} A list of {task, column} for each missing task file
   */
  async findMissingTaskFiles(index = null) {
    if (index === null) {
      index = await this.getIndex();
    }
    const missing = [];
    for (const [columnName, taskIds] of Object.entries(index.columns)) {
      for (const taskId of taskIds) {
        if (!(await this.taskFileExists(taskId))) {
          missing.push({ task: taskId, column: columnName });
        }
      }
    }
    return missing;
  }

  /**
   * Get this board's simple tasks - lines in a column that aren't task links. A simple task has a
   * title and a column and nothing else: no id, no metadata, no dates, and no presence in any of
   * kanbn's reporting. It can be moved, removed, or promoted into a real task
   *
   * When an input string is given, this returns the simple tasks matching it. Real tasks always win,
   * so callers should resolve a task id first and only fall back to this when nothing matched
   * @param {?string} [input=null] A title to match, or null for every simple task on this board
   * @param {?object} [index=null] The index object, or null to load it
   * @return {Promise<object[]>} The matching simple tasks, each with a column, position and text
   */
  async findSimpleTasks(input = null, index = null) {
    if (index === null) {
      index = await this.getIndex();
    }
    const simpleTasks = [];
    for (const [columnName, entries] of Object.entries(index.columnContent || {})) {
      for (const entry of entries) {
        if (isSimpleTask(entry)) {
          simpleTasks.push({ column: columnName, position: entry.position, text: entry.text, raw: entry.raw });
        }
      }
    }
    if (input === null) {
      return simpleTasks;
    }

    // Match on the title exactly first, then ignoring case, then on the slugified title, so that
    // `kanbn move "Buy milk"` and `kanbn move buy-milk` both find the same line
    const matchers = [
      (simpleTask) => simpleTask.text === input,
      (simpleTask) => simpleTask.text.toLowerCase() === String(input).toLowerCase(),
      (simpleTask) => utility.getTaskId(simpleTask.text) === utility.getTaskId(String(input)),
    ];
    for (const matcher of matchers) {
      const matches = simpleTasks.filter(matcher);
      if (matches.length) {
        return matches;
      }
    }
    return [];
  }

  /**
   * Resolve a string to exactly one simple task on this board, or throw
   * @param {string} input The title to match
   * @param {?object} [index=null] The index object, or null to load it
   * @return {Promise<object>} The matching simple task
   */
  async getSimpleTask(input, index = null) {
    const matches = await this.findSimpleTasks(input, index);
    if (!matches.length) {
      throw new Error(`No simple task found matching "${input}"`);
    }

    // Two lines with the same title are two different lines, and picking one of them silently would
    // eventually move or delete the wrong one
    if (matches.length > 1) {
      throw new Error(
        `"${input}" matches ${matches.length} simple tasks (${matches
          .map((match) => `"${match.text}" in ${match.column}`)
          .join(", ")})`
      );
    }
    return matches[0];
  }

  /**
   * Move a simple task to another column on this board
   * @param {string} input The title to match
   * @param {string} columnName The column to move it to
   * @param {?number} [position=null] The position in the target column, or the end of it if null
   * @return {Promise<object>} The simple task that was moved, with the column it came from
   */
  async moveSimpleTask(input, columnName, position = null) {
    let index = await this.getIndex();
    if (!(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }
    const simpleTask = await this.getSimpleTask(input, index);
    index = removeColumnContent(index, simpleTask.column, simpleTask.position);
    index = addColumnContent(index, columnName, { text: simpleTask.text, raw: simpleTask.raw }, position);
    await this.saveIndex(index);
    return { ...simpleTask, toColumn: columnName };
  }

  /**
   * Move a simple task from this board onto another one. A simple task is content in a board file
   * rather than a shared task file, so this moves the line: it leaves this board and joins the other
   * @param {string} input The title to match
   * @param {string} targetSlug The board to move it to
   * @param {?string} [columnName=null] The column on the target board, or its first column if null
   * @param {?number} [position=null] The position in the target column, or the end of it if null
   * @return {Promise<object>} The simple task that was moved, with the board and column it went to
   */
  async moveSimpleTaskToBoard(input, targetSlug, columnName = null, position = null) {
    const target = this.board(targetSlug);
    const targetBoardSlug = await target.resolveBoardSlug();
    if (!(await target.initialised())) {
      throw new Error(`Board "${targetBoardSlug}" doesn't exist`);
    }
    if (targetBoardSlug === (await this.resolveBoardSlug())) {
      throw new Error(`Simple task "${input}" is already on board "${targetBoardSlug}"`);
    }
    let index = await this.getIndex();
    const simpleTask = await this.getSimpleTask(input, index);
    let targetIndex = await target.getIndex();
    const targetColumnNames = Object.keys(targetIndex.columns);
    if (!targetColumnNames.length) {
      throw new Error(`Board "${targetBoardSlug}" has no columns`);
    }
    const targetColumn = columnName === null ? targetColumnNames[0] : columnName;
    if (!(targetColumn in targetIndex.columns)) {
      throw new Error(`Column "${targetColumn}" doesn't exist on board "${targetBoardSlug}"`);
    }

    // Write the target board first: a line that ends up on both boards is visible and easy to fix,
    // where a line removed from one board and never added to the other is gone
    targetIndex = addColumnContent(
      targetIndex,
      targetColumn,
      { text: simpleTask.text, raw: simpleTask.raw },
      position
    );
    await target.saveIndex(targetIndex);
    index = removeColumnContent(index, simpleTask.column, simpleTask.position);
    await this.saveIndex(index);
    return { ...simpleTask, toBoard: targetBoardSlug, toColumn: targetColumn };
  }

  /**
   * Remove a simple task from this board. There is no file to delete and nothing to archive - the
   * line is the whole of it
   * @param {string} input The title to match
   * @return {Promise<object>} The simple task that was removed
   */
  async deleteSimpleTask(input) {
    let index = await this.getIndex();
    const simpleTask = await this.getSimpleTask(input, index);
    index = removeColumnContent(index, simpleTask.column, simpleTask.position);
    await this.saveIndex(index);
    return simpleTask;
  }

  /**
   * Turn a simple task into a real task file, in the column it was already in. The created date is
   * the moment of promotion: a line carries no history, so there is no earlier date to know
   * @param {string} input The title to match
   * @param {?string} [columnName=null] The column to create the task in, or its own column if null
   * @return {Promise<string>} The id of the task that was created
   */
  async promoteSimpleTask(input, columnName = null) {
    const index = await this.getIndex();
    const simpleTask = await this.getSimpleTask(input, index);
    const targetColumn = columnName === null ? simpleTask.column : columnName;
    if (!(targetColumn in index.columns)) {
      throw new Error(`Column "${targetColumn}" doesn't exist`);
    }

    // Check for a clash before writing anything, so that a promotion that can't happen doesn't take
    // the line with it
    const taskId = utility.getTaskId(simpleTask.text);
    if (await this.taskFileExists(taskId)) {
      throw new Error(`A task with id "${taskId}" already exists`);
    }
    if (taskInIndex(index, taskId)) {
      throw new Error(`A task with id "${taskId}" is already in the index`);
    }

    // Create the task first: a leftover line beside a real task is reported by validate and is easy
    // to fix, where a line deleted for a task that was never created is gone
    await this.createTask({ name: simpleTask.text }, targetColumn);
    await this.saveIndex(removeColumnContent(await this.getIndex(), simpleTask.column, simpleTask.position));
    return taskId;
  }

  /**
   * Find lines in this board's columns that aren't task links. These are preserved verbatim and
   * ignored by every command, but a line that looks like it was meant to be a task link is worth
   * pointing out - it's the one way a task can silently stop being tracked
   * @param {?object} [index=null] The index object, or null to load it
   * @return {Promise<object[]>} A list of warnings, each with a board, column, type and message
   */
  async findColumnContentWarnings(index = null) {
    if (index === null) {
      index = await this.getIndex();
    }
    const boardSlug = await this.resolveBoardSlug();
    const warnings = [];
    for (const [columnName, entries] of Object.entries(index.columnContent || {})) {
      for (const entry of entries) {

        // A line that starts with link punctuation was probably meant to be a task link and has a
        // typo in it, which would otherwise look exactly like a task that has vanished from the
        // board. A checkbox item is an ordinary line, not a broken link
        let type = "non-task-line";
        let message = `column "${columnName}" contains a line that isn't a task link: ${entry.raw}`;
        if (looksLikeMalformedTaskLink(entry.raw)) {
          type = "malformed-task-link";
          message = `column "${columnName}" contains a line that looks like a malformed task link: ${entry.raw}`;

          // A line naming a task file that exists is almost certainly a task the user expects to be
          // tracked, written without the link. It isn't, and this is the only warning that says so
        } else if (
          (await this.taskFileExists(entry.text)) ||
          (await this.taskFileExists(utility.getTaskId(entry.text)))
        ) {
          type = "untracked-task-line";
          message =
            `column "${columnName}" contains a line naming a task file that exists, but it isn't a ` +
            `link so the task isn't tracked: ${entry.raw}`;
        }
        warnings.push({ board: boardSlug, column: columnName, type, text: entry.text, message });
      }
    }
    return warnings;
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
    return { ...parseTask.md2json(taskData), id: removeFileExtension(taskId) };
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
   * Check if the workspace has been initialised, regardless of which board this instance is scoped to
   * @return {Promise<boolean>} True if the main board exists
   */
  async workspaceInitialised() {
    return await exists(await this.getBoardPath(await this.getMainBoardSlug()));
  }

  /**
   * Get the slugs that can't be used for a board, because they would collide with the main board, one
   * of its aliases, or one of the workspace's folders
   * @return {Promise<string[]>} The reserved board slugs
   */
  async getReservedBoardSlugs() {
    return [
      ...MAIN_BOARD_ALIASES,
      DEFAULT_INDEX_FILE_NAME,
      boardSlugFromFileName(DEFAULT_INDEX_FILE_NAME),
      await this.getMainBoardSlug(),
      DEFAULT_TASKS_FOLDER_NAME,
      DEFAULT_ARCHIVE_FOLDER_NAME,
      await this.getTaskFolderName(),
      await this.getArchiveFolderName(),
    ];
  }

  /**
   * Check that a slug can be used for a new board, throwing a descriptive error if it can't
   * @param {string} slug The board slug to check
   * @return {Promise<string>} The validated slug
   */
  async validateBoardSlug(slug) {
    if (!slug || typeof slug !== "string" || !slug.trim()) {
      throw new Error("Board slug cannot be empty");
    }
    slug = slug.trim();
    if (slug !== utility.paramCase(slug)) {
      throw new Error(`Board slug "${slug}" is not valid, try "${utility.paramCase(slug)}"`);
    }
    if ((await this.getReservedBoardSlugs()).indexOf(slug) !== -1) {
      throw new Error(`Board slug "${slug}" is reserved`);
    }
    return slug;
  }

  /**
   * Get the boards config from the config file, i.e. the exclude list and display order
   * @return {Promise<{exclude: string[], order: string[]}>} The boards config
   */
  async getBoardsConfig() {
    const config = await this.getConfig();
    const boards =
      config !== null && typeof config.boards === "object" && config.boards !== null && !Array.isArray(config.boards)
        ? config.boards
        : {};
    return {
      exclude: (Array.isArray(boards.exclude) ? boards.exclude : []).map(boardSlugFromFileName),
      order: (Array.isArray(boards.order) ? boards.order : []).map(boardSlugFromFileName),
    };
  }

  /**
   * Find all boards in the workspace. Boards are discovered by globbing markdown files directly inside
   * the main folder, so the task and archive folders are excluded by construction. A file counts as a
   * board if it parses as an index; anything that doesn't is ignored here and reported by validate
   * @return {Promise<object[]>} A list of boards, main board first unless an explicit order says otherwise
   */
  async listBoards() {
    const mainFolder = await this.getMainFolder();
    if (!(await exists(mainFolder))) {
      return [];
    }
    const mainBoardSlug = await this.getMainBoardSlug();
    const { exclude, order } = await this.getBoardsConfig();
    const boardPaths = await globMarkdown(mainFolder);
    const boards = [];
    for (const boardPath of boardPaths) {
      const slug = boardSlugFromFileName(boardPath);
      if (exclude.indexOf(slug) !== -1) {
        continue;
      }
      let boardData = null;
      try {
        boardData = parseIndex.md2json(await fs.promises.readFile(boardPath, { encoding: "utf-8" }));
      } catch (error) {
        continue;
      }
      boards.push({
        slug,
        path: boardPath,
        name: boardData.name,
        description: boardData.description,
        main: slug === mainBoardSlug,
      });
    }

    // Order: anything named in the config order first, in that order, then the main board, then the
    // rest alphabetically
    boards.sort((a, b) => {
      const aOrder = order.indexOf(a.slug), bOrder = order.indexOf(b.slug);
      if (aOrder !== -1 || bOrder !== -1) {
        if (aOrder === -1) { return 1; }
        if (bOrder === -1) { return -1; }
        return aOrder - bOrder;
      }
      if (a.main !== b.main) {
        return a.main ? -1 : 1;
      }
      return a.slug.localeCompare(b.slug);
    });
    return boards;
  }

  /**
   * Work out which board a command should target: the --board argument, then the KANBN_BOARD
   * environment variable, then the defaultBoard option, then the main board
   * @param {?string} [slug=null] The board slug given on the command line, if any
   * @return {Promise<?string>} The target board slug, or null for the main board
   */
  async resolveTargetBoard(slug = null) {
    if (slug !== null && slug !== undefined && String(slug).trim() !== "") {
      return String(slug).trim();
    }
    if (process.env.KANBN_BOARD && process.env.KANBN_BOARD.trim() !== "") {
      return process.env.KANBN_BOARD.trim();
    }
    const workspaceOptions = await this.getWorkspaceOptions();
    if (workspaceOptions.defaultBoard && String(workspaceOptions.defaultBoard).trim() !== "") {
      return String(workspaceOptions.defaultBoard).trim();
    }
    return null;
  }

  /**
   * Get a Kanbn instance scoped to the board a command's arguments point at
   * @param {object} [args={}] The parsed command arguments
   * @return {Promise<Kanbn>} A board-scoped Kanbn instance
   */
  async boardFromArgs(args = {}) {
    return this.board(await this.resolveTargetBoard(utility.strArg(args.board) || null));
  }

  /**
   * List boards with the information `kanbn boards` displays: everything listBoards() returns, plus
   * column and task counts, completion percentage and the file's last modified date
   * @return {Promise<object[]>} A list of boards with summary information
   */
  async getBoardsSummary() {
    const boards = await this.listBoards();
    const result = [];
    for (const board of boards) {
      const summary = { ...board, columns: 0, tasks: 0, completed: 0, completedPercentage: 0, modified: null };
      try {
        const boardData = await this.loadBoard(board.slug);
        const tasks = await this.loadAllTrackedTasks(boardData);
        summary.columns = Object.keys(boardData.columns).length;
        summary.tasks = tasks.length;
        summary.completed = tasks.filter((task) => taskCompleted(boardData, task)).length;
        summary.completedPercentage = summary.tasks
          ? Math.round((summary.completed / summary.tasks) * 100)
          : 0;
      } catch (error) {
        // A board that can't be loaded is still worth listing; validate reports the reason
      }
      try {
        summary.modified = (await fs.promises.stat(board.path)).mtime;
      } catch (error) {
        summary.modified = null;
      }
      result.push(summary);
    }
    return result;
  }

  /**
   * Get every task that appears on more than one board, with the column it occupies on each
   * @param {boolean} [allTasks=false] True to include tasks that only appear on one board
   * @return {Promise<object[]>} A list of tasks and their board membership
   */
  async getCrossBoardTasks(allTasks = false) {
    const membership = {};
    for (const board of await this.listBoards()) {
      let boardData = null;
      try {
        boardData = await this.loadBoard(board.slug);
      } catch (error) {
        continue;
      }
      for (const [columnName, taskIds] of Object.entries(boardData.columns)) {
        for (const taskId of taskIds) {
          if (!(taskId in membership)) {
            membership[taskId] = {};
          }
          membership[taskId][board.slug] = columnName;
        }
      }
    }
    return Object.entries(membership)
      .filter(([, boards]) => allTasks || Object.keys(boards).length > 1)
      .map(([id, boards]) => ({ id, boards }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Get the value to record in a history event's `board` key for this instance's board. The main
   * board records nothing, which is what keeps existing task files valid and unchanged
   * @return {Promise<?string>} The board slug, or null for the main board
   */
  async historyBoard() {
    return (await this.isMainBoard()) ? null : await this.resolveBoardSlug();
  }

  /**
   * Get the action rules that apply to this board
   *
   * Rules layer like any other option: a config file value applies workspace-wide, a board's own
   * front matter applies to that board. `actionsFile` points at a file holding the same list, for
   * workspaces whose rule sets have outgrown their front matter
   * @param {?object} [index=null] The index object, or null to load it
   * @return {Promise<object[]>} The rules
   */
  async getActionRules(index = null) {
    if (index === null) {
      index = await this.getIndex();
    }
    const options = index.options || {};
    const inlineActions = "actions" in options && options.actions !== null;
    const actionsFile = "actionsFile" in options && options.actionsFile ? String(options.actionsFile) : null;

    // One overriding or extending the other would invent a second merge rule for the sake of a case
    // nobody needs, so having both is an error the author has to resolve
    if (inlineActions && actionsFile !== null) {
      throw new Error('"actions" and "actionsFile" can\'t both be set - use one or the other');
    }
    if (actionsFile !== null) {
      const filePath = path.join(await this.getMainFolder(), actionsFile);
      if (!(await exists(filePath))) {
        throw new Error(`actionsFile "${actionsFile}" doesn't exist`);
      }

      // A rule set that quietly stops existing is worse than one that fails loudly, so an
      // unreadable or unparseable file is an error rather than "no rules"
      return actions.parseActionsFile(await fs.promises.readFile(filePath, { encoding: "utf-8" }), actionsFile);
    }
    return actions.normaliseRules(options.actions || []);
  }

  /**
   * Check whether actions should run at all
   * @return {boolean} True if actions are enabled
   */
  actionsAllowed() {
    if (!this.actionsEnabled) {
      return false;
    }
    const disabled = process.env.KANBN_NO_ACTIONS;
    return !(disabled && disabled !== "0" && disabled !== "false");
  }

  /**
   * Get the value to record in a history event's `board` key for another board
   * @param {string} slug The board slug
   * @return {Promise<?string>} The board slug, or null for the main board
   */
  async historyBoardFor(slug) {
    return slug === (await this.getMainBoardSlug()) ? null : slug;
  }

  /**
   * Run the rules that match an event and fold everything they produce into the in-memory state
   *
   * Nothing is written here. Every verb becomes a patch to a task or to the index that the operation
   * was already going to write, which is what makes a rule that fails leave the workspace alone, and
   * what makes "actions never fire actions" structural: the writes this produces are performed with
   * no event assembly at all
   * @param {object} params The event, the in-memory index and task, and the operation's timestamp
   * @return {Promise<?object>} The action result, or null if no rules ran
   */
  async runActions({ eventTypes, index, taskId, taskData, payload, date, taskBoards = null }) {
    this.lastActionWarnings = [];
    if (!this.actionsAllowed()) {
      return null;
    }
    const boardSlug = await this.resolveBoardSlug();

    // A task on its way to being created hasn't been through the parser yet, so it has no id. The
    // filter vocabulary and the relation graph are both keyed on it
    if (!taskData.id) {
      taskData.id = taskId;
    }
    const rules = await this.getActionRules(index);

    // Archiving, restoring and deleting affect every board, so the board a command happened to be
    // run from is an arbitrary choice of whose rules to fire. A rule elsewhere can opt in to hearing
    // about them whoever triggered them - which is why this is collected before the early return:
    // a board with no rules of its own can still be the one an archive was run from
    let borrowed = [];
    if (
      taskBoards !== false &&
      eventTypes.some((eventType) => actions.WORKSPACE_WIDE_EVENTS.indexOf(eventType) !== -1) &&
      (await this.listBoards()).length > 1
    ) {
      borrowed = await this.borrowedActionRules(taskId, boardSlug, eventTypes, taskBoards);
    }
    if (!rules.length && !borrowed.length) {
      return null;
    }

    // Configuration errors fail the operation before anything is written. Checking the whole rule
    // set rather than just the matching rules means a typo is reported the first time any command
    // runs, not the first time that one rule would have fired
    if (rules.length) {
      const context = { columns: Object.keys(index.columns) };
      if (
        rules.some(
          (rule) =>
            Array.isArray(rule.then) &&
            rule.then.some((verb) => verb !== null && typeof verb === "object" && "addToBoard" in verb)
        )
      ) {
        context.boards = (await this.listBoards()).map((board) => board.slug);
      }
      const errors = actions.findRuleErrors(rules, context);
      if (errors.length) {
        throw new Error(`Invalid actions:${errors.map((error) => `\n  ${error}`).join("")}`);
      }
    }

    // This board's rules run first, then the ones that asked to listen from elsewhere
    const relevant = [...rules.filter((rule) => eventTypes.indexOf(rule.on) !== -1), ...borrowed];
    if (!relevant.length) {
      return null;
    }
    const result = await actions.run({
      rules: relevant,
      eventTypes,
      payload: { ...payload, board: boardSlug, boardSlug, isMainBoard: await this.isMainBoard() },
      index,
      task: taskData,
      date,
      user: await this.currentUser(),
      boardSlug,
      helpers: ACTION_HELPERS,
      loadTask: async (id) => {
        try {
          return await this.loadTask(id);
        } catch (error) {
          return null;
        }
      },
      loadAllTasks: async () => await this.loadAllTrackedTasks(index)
    });

    // Appended rather than replaced: collecting the rules can warn too, and those warnings matter
    this.lastActionWarnings.push(...result.warnings);

    // Board memberships and cross-task moves are recorded in the task's history the same way the
    // equivalent manual operations are, attributed to the rule rather than to a person
    for (const add of result.patch.boardAdds) {
      taskData = appendTaskHistory(
        taskData,
        { date, type: "added", column: add.column },
        await this.historyBoardFor(add.board),
        add.author
      );
    }
    for (const target of result.targets) {
      for (const add of target.boardAdds) {
        target.task = appendTaskHistory(
          target.task,
          { date, type: "added", column: add.column },
          await this.historyBoardFor(add.board),
          add.author
        );
      }
      if (target.moveTo === null) {
        continue;
      }

      // A target that isn't on this board has no row in this index to move, and a target already in
      // the column it would be moved to is a no-op rather than an event
      if (!taskInIndex(index, target.task.id)) {
        this.lastActionWarnings.push(
          `skipped moving "${target.task.id}": it isn't on board "${boardSlug}"`
        );
        target.moveTo = null;
        continue;
      }
      const fromColumn = findTaskColumn(index, target.task.id);
      if (fromColumn === target.moveTo.column) {
        target.moveTo = null;
        continue;
      }
      target.task = appendTaskHistory(
        target.task,
        { date, type: "moved", fromColumn, toColumn: target.moveTo.column },
        await this.historyBoard(),
        target.moveTo.author
      );
      target.task = setTaskMetadata(target.task, "updated", date);
      index = removeTaskFromIndex(index, target.task.id);
      index = addTaskToIndex(index, target.task.id, target.moveTo.column, target.moveTo.position);
    }
    result.index = index;
    result.taskData = taskData;
    return result;
  }

  /**
   * Collect the rules on other boards that have opted in to hearing about a workspace-wide event
   *
   * Board membership is per-board data and can't conflict, but rule verbs write the single shared
   * task file, where two boards' rules genuinely can. So the acting board decides what gets written
   * by default, and a rule elsewhere has to say that it wants to listen
   * @param {string} taskId The task the event fired for
   * @param {string} boardSlug The acting board
   * @param {string[]} eventTypes The events that fired
   * @param {?string[]} [knownBoards=null] The boards this operation affects, when the index can't say
   * @return {Promise<object[]>} The rules to run after this board's own
   */
  async borrowedActionRules(taskId, boardSlug, eventTypes, knownBoards = null) {
    // A task being restored isn't on any board yet, so the caller has to say which boards it is
    // about to rejoin. Everywhere else the index is the authority
    const taskBoards = (knownBoards === null
      ? Object.keys(await this.findTaskBoards(taskId))
      : knownBoards
    ).filter((slug) => slug !== boardSlug);
    if (!taskBoards.length) {
      return [];
    }

    // Board order is whatever `kanbn boards` shows, so which rule wins when two of them write the
    // same field is at least stable and inspectable
    const ordered = (await this.listBoards()).map((board) => board.slug).filter((slug) => taskBoards.indexOf(slug) !== -1);
    const borrowed = [];
    for (const slug of ordered) {
      const otherBoard = this.board(slug);
      let otherRules = [];
      try {
        otherRules = await otherBoard.getActionRules();
      } catch (error) {
        this.lastActionWarnings.push(`skipped board "${slug}" rules: ${error.message}`);
        continue;
      }
      const listening = otherRules.filter((rule) => rule.anyBoard === true && eventTypes.indexOf(rule.on) !== -1);
      if (!listening.length) {
        continue;
      }

      // Another board's mistake shouldn't fail a command that didn't ask for that board. Its rules
      // are skipped instead, and kanbn validate --all-boards reports why
      const errors = actions.findRuleErrors(listening, {
        columns: Object.keys((await otherBoard.getIndex()).columns)
      });
      if (errors.length) {
        this.lastActionWarnings.push(`skipped board "${slug}" rules: ${errors[0]}`);
        continue;
      }
      borrowed.push(...listening);
    }
    return borrowed;
  }

  /**
   * Write the task files and board memberships a rule asked for
   *
   * These come after the operation's own writes because they are separate files: the patches were
   * all computed before anything was written, so a failure here can't leave a half-applied rule
   * @param {?object} result The action result, or null if no rules ran
   * @param {string} taskId The id of the task the event fired for
   */
  async completeActions(result, taskId) {
    if (result === null) {
      return;
    }
    const taskFolder = await this.getTaskFolderPath();
    for (const target of result.targets) {
      await this.saveTask(getTaskPath(taskFolder, target.task.id), target.task);
    }
    const boardAdds = [
      ...result.patch.boardAdds.map((add) => ({ ...add, taskId })),
      ...result.targets.flatMap((target) => target.boardAdds.map((add) => ({ ...add, taskId: target.task.id })))
    ];
    const thisBoardSlug = await this.resolveBoardSlug();
    for (const add of boardAdds) {
      const slug = await this.resolveBoardSlug(add.board);
      if (slug === thisBoardSlug) {
        continue;
      }
      if (!(await this.boardExists(slug))) {
        this.lastActionWarnings.push(`skipped adding "${add.taskId}" to board "${add.board}": no such board`);
        continue;
      }
      const otherBoard = this.board(slug);
      const otherIndex = await otherBoard.loadIndex();
      if (!(add.column in otherIndex.columns)) {
        this.lastActionWarnings.push(
          `skipped adding "${add.taskId}" to board "${add.board}": no column "${add.column}"`
        );
        continue;
      }
      if (taskInIndex(otherIndex, add.taskId)) {
        continue;
      }
      await otherBoard.saveIndex(addTaskToIndex(otherIndex, add.taskId, add.column));
    }
  }

  /**
   * Work out which derived events an operation fired
   *
   * `task.started` and `task.completed` aren't operations - they're transitions, computed from the
   * state before the operation and the state it is about to write, so a rule meaning "when this is
   * done" doesn't have to duplicate the board's column list. They're computed before any rule runs,
   * so a rule that sets a completed date doesn't fire task.completed
   * @param {object} index The index object
   * @param {?object} before The task as it was, or null if it didn't exist
   * @param {object} after The task the operation is about to write
   * @return {string[]} The derived event types that fired
   */
  derivedEvents(index, before, after) {
    const events = [];
    if (!taskStarted(index, { ...after, metadata: before === null ? {} : before.metadata }) && taskStarted(index, after)) {
      events.push("task.started");
    }
    if (
      !taskCompleted(index, { ...after, metadata: before === null ? {} : before.metadata }) &&
      taskCompleted(index, after)
    ) {
      events.push("task.completed");
    }
    return events;
  }

  /**
   * Check if a board exists
   * @param {string} slug The board slug
   * @return {Promise<boolean>} True if the board file exists
   */
  async boardExists(slug) {
    return await exists(await this.getBoardPath(slug));
  }

  /**
   * Create a new board
   * @param {string} slug The board slug
   * @param {object} [options={}] The board's name, description, columns and options
   * @return {Promise<string>} The created board's slug
   */
  async createBoard(slug, options = {}) {
    const validatedSlug = await this.validateBoardSlug(slug);
    if (await this.boardExists(validatedSlug)) {
      throw new Error(`Board "${validatedSlug}" already exists`);
    }
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }
    const columns =
      "columns" in options && options.columns.length ? options.columns : defaultInitialiseOptions.columns;

    // A new board only picks up the default started and completed columns if it actually has columns
    // by those names - a design board with Ideas/Designing/Signed Off shouldn't silently claim that
    // "In Progress" started work and "Done" finished it
    const boardOptions = "options" in options ? { ...options.options } : {};
    for (const [key, defaultColumns] of Object.entries(defaultInitialiseOptions.options)) {
      if (key in boardOptions) {
        continue;
      }
      const matchingColumns = defaultColumns.filter((columnName) => columns.indexOf(columnName) !== -1);
      if (matchingColumns.length) {
        boardOptions[key] = matchingColumns;
      }
    }

    const board = {
      name: "name" in options && options.name ? options.name : validatedSlug,
      description: "description" in options ? options.description : "",
      options: boardOptions,
      columns: Object.fromEntries(columns.map((columnName) => [columnName, []])),
    };

    // Options passed to createBoard are deliberate, so they're written to the board file even when
    // the workspace happens to provide the same value
    setOwnOptions(board, boardOptions);
    await this.saveBoard(validatedSlug, board);
    return validatedSlug;
  }

  /**
   * Delete a board file. Tasks referenced only by this board become untracked; their files are left
   * alone, since boards own membership and tasks are shared
   * @param {string} slug The board slug
   * @return {Promise<string[]>} The ids of tasks that are no longer referenced by any board
   */
  async deleteBoard(slug) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    if (await this.isMainBoard(resolvedSlug)) {
      throw new Error("The main board cannot be deleted");
    }
    if (!(await this.boardExists(resolvedSlug))) {
      throw new Error(`Board "${resolvedSlug}" doesn't exist`);
    }
    const orphaned = await this.findOrphanedTasks(resolvedSlug);
    await fs.promises.unlink(await this.getBoardPath(resolvedSlug));
    return orphaned;
  }

  /**
   * Find the tasks that would become untracked if a board were deleted, i.e. the tasks it references
   * that no other board references
   * @param {string} slug The board slug
   * @return {Promise<string[]>} The ids of tasks referenced only by this board
   */
  async findOrphanedTasks(slug) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    const taskIds = [...getTrackedTaskIds(await this.loadBoard(resolvedSlug))];
    const orphaned = [];
    for (const taskId of taskIds) {
      const boards = await this.findTaskBoards(taskId);
      if (Object.keys(boards).filter((boardSlug) => boardSlug !== resolvedSlug).length === 0) {
        orphaned.push(taskId);
      }
    }
    return orphaned;
  }

  /**
   * Rename a board
   * @param {string} slug The board slug
   * @param {string} newSlug The new board slug
   * @param {?string} [newName=null] An optional new display name for the board
   * @return {Promise<string>} The new slug
   */
  async renameBoard(slug, newSlug, newName = null) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    if (await this.isMainBoard(resolvedSlug)) {
      throw new Error("The main board cannot be renamed");
    }
    if (!(await this.boardExists(resolvedSlug))) {
      throw new Error(`Board "${resolvedSlug}" doesn't exist`);
    }
    const validatedSlug = await this.validateBoardSlug(newSlug);
    if (validatedSlug !== resolvedSlug && (await this.boardExists(validatedSlug))) {
      throw new Error(`Board "${validatedSlug}" already exists`);
    }
    const board = await this.loadBoard(resolvedSlug);
    if (newName !== null) {
      board.name = newName;
    }
    if (validatedSlug !== resolvedSlug) {
      await fs.promises.rename(await this.getBoardPath(resolvedSlug), await this.getBoardPath(validatedSlug));
    }
    await this.saveBoard(validatedSlug, board);
    return validatedSlug;
  }

  /**
   * Find every board that references a task, and the column it occupies on each
   * @param {string} taskId The task id
   * @return {Promise<Record<string, string>>} A map of board slug to column name
   */
  async findTaskBoards(taskId) {
    const result = {};
    for (const board of await this.listBoards()) {
      let boardData = null;
      try {
        boardData = await this.loadBoard(board.slug);
      } catch (error) {
        continue;
      }
      const columnName = findTaskColumn(boardData, taskId);
      if (columnName !== null) {
        result[board.slug] = columnName;
      }
    }
    return result;
  }

  /**
   * Alias for findTaskBoards(), used when displaying a task's board membership
   * @param {string} taskId The task id
   * @return {Promise<Record<string, string>>} A map of board slug to column name
   */
  async getTaskBoardColumns(taskId) {
    return this.findTaskBoards(taskId);
  }

  /**
   * Initialise a kanbn board in the current working directory
   * @param {object} [options={}] Initial columns and other config options
   */
  async initialise(options = {}) {
    // A board-scoped instance initialises its own board rather than the workspace
    if (!(await this.isMainBoard())) {
      return this.initialiseBoard(this.boardSlug, options);
    }

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
   * Create a secondary board, or update an existing one's name, description, columns and options
   * @param {string} slug The board slug
   * @param {object} [options={}] The board's name, description, columns and options
   * @return {Promise<string>} The board slug
   */
  async initialiseBoard(slug, options = {}) {
    const resolvedSlug = await this.resolveBoardSlug(slug);
    if (!(await this.boardExists(resolvedSlug))) {
      return this.createBoard(resolvedSlug, options);
    }
    if (Object.keys(options).length === 0) {
      return resolvedSlug;
    }

    // The board already exists, so update it in the same way initialise() updates the main board
    const board = await this.loadBoard(resolvedSlug);
    "name" in options && options.name && (board.name = options.name);
    "description" in options && (board.description = options.description);
    if ("options" in options) {
      board.options = Object.assign(board.options, options.options);
      setOwnOptions(board, { ...board.ownOptions, ...options.options });
    }
    "columns" in options &&
      (board.columns = Object.assign(
        board.columns,
        Object.fromEntries(
          options.columns.map((columnName) => [
            columnName,
            columnName in board.columns ? board.columns[columnName] : [],
          ])
        )
      ));
    await this.saveBoard(resolvedSlug, board);
    return resolvedSlug;
  }

  /**
   * Check if a task file exists, regardless of whether any board references it
   * @param {string} taskId The task id to check
   * @return {Promise<boolean>} True if the task file exists
   */
  async taskFileExists(taskId) {
    return exists(getTaskPath(await this.getTaskFolderPath(), removeFileExtension(taskId)));
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
   * Resolve a possibly partial task id against the tasks in this board's index
   *
   * Tried in order, stopping at the first rung that matches anything: an exact id in the index, a task
   * file with exactly this id, a unique case-insensitive prefix, a unique case-insensitive substring,
   * then (only when the taskIdResolution option is "fuzzy") a unique fuzzy match. Inputs shorter
   * than MIN_PARTIAL_TASK_ID_LENGTH skip everything but the exact rungs. A rung with more
   * than one match is ambiguous and throws, listing the candidates, rather than falling through to a
   * looser rung. When nothing matches, the input is returned unchanged so that the caller reports
   * whatever it reported before resolution existed
   * @param {string} input The task id, or part of one
   * @return {Promise<object>} The resolved id, and which rung matched it ("exact", "file", "prefix",
   * "substring", "fuzzy", or null if nothing matched)
   */
  async resolveTaskId(input) {
    const index = await this.getIndex();
    const taskIds = [...getTrackedTaskIds(index)];
    if (!input) {
      return { id: input, match: null };
    }

    // Exact matches are what every command did before, so they always win
    if (taskIds.includes(input) || (await this.taskFileExists(input))) {
      return { id: input, match: taskIds.includes(input) ? "exact" : "file" };
    }

    const mode = TASK_ID_RESOLUTION_MODES.includes(index.options.taskIdResolution)
      ? index.options.taskIdResolution
      : DEFAULT_TASK_ID_RESOLUTION;
    if (mode === "exact" || input.length < MIN_PARTIAL_TASK_ID_LENGTH) {
      return { id: input, match: null };
    }

    const lowerInput = input.toLowerCase();
    const rungs = [
      ["prefix", (ids) => ids.filter((id) => id.toLowerCase().startsWith(lowerInput))],
      ["substring", (ids) => ids.filter((id) => id.toLowerCase().includes(lowerInput))],
    ];
    if (mode === "fuzzy") {
      rungs.push(["fuzzy", (ids) => fuzzy.filter(input, ids).map((result) => result.string)]);
    }
    for (const [match, filter] of rungs) {
      const matches = filter(taskIds);
      if (matches.length === 1) {
        return { id: matches[0], match };
      }
      if (matches.length > 1) {
        const shown = matches.slice(0, MAX_AMBIGUOUS_TASK_IDS);
        const more = matches.length - shown.length;
        const error = new Error(
          `Task id "${input}" is ambiguous, it could be:\n` +
            shown.map((id) => `  ${id}`).join("\n") +
            (more > 0 ? `\n  ...and ${more} more` : "")
        );
        error.candidates = matches;
        throw error;
      }
    }
    return { id: input, match: null };
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

    // Stamp every date this call writes with the same timestamp, so that the created date and the
    // column-linked dates can't disagree by a millisecond
    const now = new Date();

    // Set the created date
    taskData = setTaskMetadata(taskData, "created", now);

    // Add initial history event
    taskData = appendTaskHistory(taskData, {
      date: now,
      type: 'created',
      column: columnName,
      fromProgress: 0,
      toProgress: getTaskMetadata(taskData, 'progress') || 0
    }, await this.historyBoard(), await this.currentUser());

    // Update task metadata dates
    const beforeActions = { ...taskData, metadata: {} };
    taskData = updateColumnLinkedCustomFields(index, taskData, columnName, now);

    // Add the task to the index before running rules, so that a rule filtering on the task's column
    // sees the column it is being created in
    index = addTaskToIndex(index, taskId, columnName);

    // Run actions and fold whatever they produce into the writes below
    const result = await this.runActions({
      eventTypes: ["task.created", ...this.derivedEvents(index, beforeActions, taskData)],
      index,
      taskId,
      taskData,
      payload: { column: columnName },
      date: now
    });
    if (result !== null) {
      ({ index, taskData } = result);
      if (result.patch.moveTo !== null && result.patch.moveTo.column !== columnName) {
        columnName = result.patch.moveTo.column;
        index = removeTaskFromIndex(index, taskId);
        index = addTaskToIndex(index, taskId, columnName, result.patch.moveTo.position);
        taskData = updateColumnLinkedCustomFields(index, taskData, columnName, now);
      }
    }
    await this.saveTask(taskPath, taskData);
    await this.saveIndex(index);
    await this.completeActions(result, taskId);
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
    const now = new Date();

    // Record the task joining this board. Board membership has no other representation in a task
    // file, so without this event a board's history has no record of the task ever arriving
    taskData = appendTaskHistory(taskData, {
      date: now,
      type: 'added',
      column: columnName
    }, await this.historyBoard(), await this.currentUser());

    // Update task metadata dates
    const beforeActions = { ...taskData, metadata: { ...taskData.metadata } };
    taskData = updateColumnLinkedCustomFields(index, taskData, columnName, now);

    // Add the task to the column before running rules, so that a rule filtering on the task's
    // column sees the column it is joining
    index = addTaskToIndex(index, taskId, columnName);

    // Run actions and fold whatever they produce into the writes below
    const result = await this.runActions({
      eventTypes: ["task.addedToBoard", ...this.derivedEvents(index, beforeActions, taskData)],
      index,
      taskId,
      taskData,
      payload: { column: columnName, board: await this.resolveBoardSlug() },
      date: now
    });
    if (result !== null) {
      ({ index, taskData } = result);
      if (result.patch.moveTo !== null && result.patch.moveTo.column !== columnName) {
        columnName = result.patch.moveTo.column;
        index = removeTaskFromIndex(index, taskId);
        index = addTaskToIndex(index, taskId, columnName, result.patch.moveTo.position);
        taskData = updateColumnLinkedCustomFields(index, taskData, columnName, now);
      }
    }
    await this.saveTask(taskPath, taskData);
    await this.saveIndex(index);
    await this.completeActions(result, taskId);
    return taskId;
  }

  /**
   * Add an existing task to this board. Boards own membership, so the same task file can be added to
   * any number of boards, in a different column on each
   * @param {string} taskId The task id
   * @param {string} columnName The column to add the task to
   * @return {Promise<string>} The id of the task that was added
   */
  async addTaskToBoard(taskId, columnName) {
    return this.addUntrackedTaskToIndex(taskId, columnName);
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
    const files = await globMarkdown(await this.getTaskFolderPath());
    const untrackedTasks = new Set(files.map((task) => path.parse(task).name));

    // Return the set difference
    return new Set([...untrackedTasks].filter((x) => !trackedTasks.has(x)));
  }

  /**
   * Find tasks that no board references at all. "Tracked" is workspace-scoped: a task is tracked if
   * any board references it, so a task can be missing from this board and still be tracked
   * @return {Promise<Set<string>>} A set of untracked task ids
   */
  async findWorkspaceUntrackedTasks() {
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }

    // Collect the tasks referenced by every board
    const trackedTasks = new Set();
    for (const board of await this.listBoards()) {
      try {
        for (const taskId of getTrackedTaskIds(await this.loadBoard(board.slug))) {
          trackedTasks.add(taskId);
        }
      } catch (error) {
        continue;
      }
    }

    // Get all tasks in the tasks folder and return the set difference
    const files = await globMarkdown(await this.getTaskFolderPath());
    return new Set(files.map((task) => path.parse(task).name).filter((taskId) => !trackedTasks.has(taskId)));
  }

  /**
   * Find tasks that other boards track but this one doesn't - the "what could I pull onto this board"
   * list
   * @return {Promise<Record<string, Record<string, string>>>} A map of task id to board slug to column
   */
  async findTasksOnOtherBoards() {
    const thisBoardSlug = await this.resolveBoardSlug();
    const trackedHere = getTrackedTaskIds(await this.loadIndex());
    const result = {};
    for (const board of await this.listBoards()) {
      if (board.slug === thisBoardSlug) {
        continue;
      }
      let boardData = null;
      try {
        boardData = await this.loadBoard(board.slug);
      } catch (error) {
        continue;
      }
      for (const [columnName, taskIds] of Object.entries(boardData.columns)) {
        for (const taskId of taskIds) {
          if (trackedHere.has(taskId)) {
            continue;
          }
          if (!(taskId in result)) {
            result[taskId] = {};
          }
          result[taskId][board.slug] = columnName;
        }
      }
    }
    return result;
  }

  /**
   * Update an existing task
   * @param {string} taskId The id of the task to update
   * @param {object} taskData The new task data
   * @param {?string} [columnName=null] The column name to move this task to, or null if not moving this task
   * @param {string[]} [unsetFields=[]] Metadata field names to remove from the task
   * @return {Promise<string>} The id of the task that was updated
   */
  async updateTask(taskId, taskData, columnName = null, unsetFields = []) {
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

    // Stamp every date this call writes with the same timestamp, so that the updated date and the
    // history event it records can't disagree by a millisecond
    const now = new Date();

    // Set the updated date
    taskData = setTaskMetadata(taskData, "updated", now);

    // Add history for progress changes only
    const originalProgress = getTaskMetadata(originalTaskData, 'progress') || 0;
    const updatedProgress = getTaskMetadata(taskData, 'progress') || 0;
    if (originalProgress !== updatedProgress) {
      taskData = appendTaskHistory(taskData, {
        date: now,
        type: 'progress',
        fromProgress: originalProgress,
        toProgress: updatedProgress
      }, null, await this.currentUser());
    }

    // Run actions. A task.updated rule that moves the task redirects the move this call was going
    // to make, or makes one of its own if the caller didn't ask for a column change
    const result = await this.runActions({
      eventTypes: ["task.updated", ...this.derivedEvents(index, originalTaskData, taskData)],
      index,
      taskId,
      taskData,
      payload: { changedFields: changedFields(originalTaskData, taskData), unsetFields: [...unsetFields] },
      date: now
    });
    let rulePosition = null;
    if (result !== null) {
      ({ index, taskData } = result);
      if (result.patch.moveTo !== null) {
        rulePosition = result.patch.moveTo.position;
        if (columnName === null) {
          const fromColumn = findTaskColumn(index, taskId);
          if (fromColumn !== result.patch.moveTo.column) {
            taskData = appendTaskHistory(
              taskData,
              { date: now, type: "moved", fromColumn, toColumn: result.patch.moveTo.column },
              await this.historyBoard(),
              result.patch.moveTo.author
            );
            index = removeTaskFromIndex(index, taskId);
            index = addTaskToIndex(index, taskId, result.patch.moveTo.column, rulePosition);
            taskData = updateColumnLinkedCustomFields(index, taskData, result.patch.moveTo.column, now);
          }
        } else {
          columnName = result.patch.moveTo.column;
        }
      }
    }

    // Save task
    await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);

    // Move the task if we're updating the column
    if (columnName) {
      // The move is a nested operation that fires its own rules, and reports its own skips. Keep
      // this call's warnings in front of them rather than letting the move discard them
      const updateWarnings = [...this.lastActionWarnings];
      await this.moveTask(taskId, columnName, rulePosition);
      this.lastActionWarnings = [...updateWarnings, ...this.lastActionWarnings];

      // Otherwise save the index
    } else {
      await this.saveIndex(index);
    }
    await this.completeActions(result, taskId);

    // Remove any explicitly unset metadata fields last. This has to happen after the move, because
    // moving into a started or completed column stamps the linked date fields - an explicit unset
    // from the user should win over that automatic stamp
    if (unsetFields.length) {
      const finalTaskData = await this.loadTask(taskId);
      if ("metadata" in finalTaskData) {
        for (const field of unsetFields) {
          delete finalTaskData.metadata[field];
        }
      }
      await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), finalTaskData);
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

    // Check that a task with the new id isn't already indexed, on this board or any other - the id
    // is the file name, so it has to be free everywhere
    if (taskInIndex(index, newTaskId)) {
      throw new Error(`A task with id "${newTaskId}" is already in the index`);
    }
    const boardsWithNewId = Object.keys(await this.findTaskBoards(newTaskId));
    if (boardsWithNewId.length) {
      throw new Error(
        `A task with id "${newTaskId}" is already on board "${boardsWithNewId[0]}"`
      );
    }

    // Note every board that references this task before anything is written
    const otherBoards = await this.findTaskBoards(taskId);

    // Update the task name and updated date
    let taskData = await this.loadTask(taskId);
    taskData.name = newTaskName;
    taskData = setTaskMetadata(taskData, "updated", new Date());
    await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);

    // Rename the task file
    await fs.promises.rename(getTaskPath(await this.getTaskFolderPath(), taskId), newTaskPath);

    // Update the task id in the index, and in every other board that references it - the task file
    // has moved, so a board still pointing at the old id would have a broken link
    const thisBoardSlug = await this.resolveBoardSlug();
    for (const slug of Object.keys(otherBoards)) {
      if (slug === thisBoardSlug) {
        continue;
      }
      const otherBoard = this.board(slug);
      const otherIndex = await otherBoard.loadIndex();
      await otherBoard.saveIndex(renameTaskInIndex(otherIndex, taskId, newTaskId));
    }
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
   * @param {boolean} [add=false] Add the task to this board if it isn't on it yet (secondary boards only)
   * @return {Promise<string>} The id of the task that was moved
   */
  async moveTask(taskId, columnName, position = null, relative = false, add = false) {
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

      // Moving a task onto a board it isn't on yet adds it, so that membership doesn't have to be a
      // separate step. Only on a secondary board: on the main board this stays the error it has
      // always been
      if (!add || (await this.isMainBoard())) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }
      if (!(columnName in index.columns)) {
        throw new Error(`Column "${columnName}" doesn't exist`);
      }
      await this.addTaskToBoard(taskId, columnName);
      return taskId;
    }

    // Make sure the target column exists
    if (!(columnName in index.columns)) {
      throw new Error(`Column "${columnName}" doesn't exist`);
    }

    // Find current column before mutating data
    const currentColumnName = findTaskColumn(index, taskId);

    // Stamp every date this move writes with the same timestamp, so that the history event and the
    // dates it backfills from can't disagree by a millisecond
    const moveDate = new Date();

    // Update the task's updated date
    let taskData = await this.loadTask(taskId);
    taskData = setTaskMetadata(taskData, "updated", moveDate);

    // Add history only when a task changes columns
    if (currentColumnName !== columnName) {
      taskData = appendTaskHistory(taskData, {
        date: moveDate,
        type: 'moved',
        fromColumn: currentColumnName,
        toColumn: columnName
      }, await this.historyBoard(), await this.currentUser());
    }

    // Update task metadata dates
    const beforeActions = { ...taskData, metadata: { ...taskData.metadata } };
    taskData = updateColumnLinkedCustomFields(index, taskData, columnName, moveDate);

    // If we're moving the task to a new position, calculate the absolute position
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

    // Run actions. A rule that moves the task changes the destination of the write that was already
    // about to happen, rather than performing a second move
    const eventTypes = this.derivedEvents(index, beforeActions, taskData);
    if (currentColumnName !== columnName) {
      eventTypes.unshift("task.moved");
    }
    const result = await this.runActions({
      eventTypes,
      index,
      taskId,
      taskData,
      payload: { fromColumn: currentColumnName, toColumn: columnName },
      date: moveDate
    });
    if (result !== null) {
      ({ index, taskData } = result);
      if (result.patch.moveTo !== null && result.patch.moveTo.column !== columnName) {
        const ruleColumn = result.patch.moveTo.column;
        taskData = appendTaskHistory(
          taskData,
          { date: moveDate, type: "moved", fromColumn: columnName, toColumn: ruleColumn },
          await this.historyBoard(),
          result.patch.moveTo.author
        );
        index = removeTaskFromIndex(index, taskId);
        index = addTaskToIndex(index, taskId, ruleColumn, result.patch.moveTo.position);
        taskData = updateColumnLinkedCustomFields(index, taskData, ruleColumn, moveDate);
      }
    }
    await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);
    await this.saveIndex(index);
    await this.completeActions(result, taskId);
    return taskId;
  }

  /**
   * Remove a task from the index and optionally delete the task file as well
   * @param {string} taskId The id of the task to remove
   * @param {boolean} [removeFile=false] True if the task file should be removed
   * @param {boolean} [allBoards=false] True to remove the task from every board that references it
   * @return {Promise<string>} The id of the task that was deleted
   */
  async deleteTask(taskId, removeFile = false, allBoards = false) {
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

    // A task file is shared, so deleting it out from under another board would break that board.
    // Removing the task from this board only is always safe, and is what happens without --all-boards
    const thisBoardSlug = await this.resolveBoardSlug();
    const otherBoards = Object.keys(await this.findTaskBoards(taskId)).filter((slug) => slug !== thisBoardSlug);
    if (removeFile && otherBoards.length && !allBoards) {
      throw new Error(
        `Task "${taskId}" is on ${otherBoards.length} other ${otherBoards.length === 1 ? "board" : "boards"} ` +
          `(${otherBoards.join(", ")})`
      );
    }

    // Run actions before anything is removed, so that a rule's targets are selected from the task's
    // relations while the task is still there to have them
    const columnName = findTaskColumn(index, taskId);
    const taskFileExists = await exists(getTaskPath(await this.getTaskFolderPath(), taskId));
    let result = null;
    if (taskFileExists) {
      result = await this.runActions({
        eventTypes: ["task.deleted"],
        index,
        taskId,
        taskData: await this.loadTask(taskId),
        payload: { fromColumn: columnName, removeFile, allBoards },

        // Removing a task from one board isn't a workspace-wide operation, whatever the event is
        // called, so the other boards' rules have nothing to hear about
        taskBoards: allBoards ? null : false,
        date: new Date()
      });
      if (result !== null) {
        index = result.index;
      }
    }

    // Remove the task from whichever column it's in
    index = removeTaskFromIndex(index, taskId);

    // Record the task leaving this board, but only when the task file survives - a removed event on
    // a file that's about to be deleted records nothing anyone can read
    if (!removeFile && (await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      let taskData = await this.loadTask(taskId);
      taskData = appendTaskHistory(taskData, {
        type: 'removed',
        fromColumn: columnName
      }, await this.historyBoard(), await this.currentUser());
      await this.saveTask(getTaskPath(await this.getTaskFolderPath(), taskId), taskData);
    }

    // Optionally remove the task from every other board, and remove the task file as well
    if (allBoards) {
      for (const slug of otherBoards) {
        const otherBoard = this.board(slug);
        const otherIndex = await otherBoard.loadIndex();
        await otherBoard.saveIndex(removeTaskFromIndex(otherIndex, taskId));
      }
    }
    if (removeFile && (await exists(getTaskPath(await this.getTaskFolderPath(), taskId)))) {
      await fs.promises.unlink(getTaskPath(await this.getTaskFolderPath(), taskId));
    }
    await this.saveIndex(index);
    await this.completeActions(result, taskId);
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
      return quiet ? task.id : this.hydrateTask(index, task);
    });
  }

  /**
   * Search every board in the workspace. A task on several boards appears once, annotated with the
   * board and column it occupies on each
   * @param {object} [filters={}] The filters to apply
   * @param {boolean} [quiet=false] Only return task ids if true, otherwise return full task details
   * @return {Promise<object[]|string[]>} A list of matching tasks, or task ids
   */
  async searchAllBoards(filters = {}, quiet = false) {
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }
    const results = new Map();
    for (const board of await this.listBoards()) {
      let matches = [];
      try {
        matches = await this.board(board.slug).search(filters, quiet);
      } catch (error) {
        continue;
      }
      for (const match of matches) {
        const taskId = quiet ? match : match.id;
        if (!results.has(taskId)) {
          results.set(taskId, quiet ? taskId : { ...match, boards: {} });
        }
        if (!quiet) {
          results.get(taskId).boards[board.slug] = match.column;
        }
      }
    }
    return [...results.values()];
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
    const startedField = getStartedField(index);
    const completedField = getCompletedField(index);

    // Prepare output
    const result = {
      name: index.name,
    };

    // Name the board this status applies to, but only once there is more than one board - a
    // single-board workspace produces exactly the output it always has
    const boards = await this.listBoards();
    if (boards.length > 1) {
      result.board = await this.resolveBoardSlug();
    }

    // Get un-tracked tasks if required
    if (untracked) {

      // Untracked means "on no board at all", which is workspace-scoped
      result.untrackedTasks = [...(await this.findWorkspaceUntrackedTasks())].map((taskId) => `${taskId}.md`);

      // If output is quiet, output a list of untracked task filenames
      if (quiet) {
        return result.untrackedTasks;
      }

      // Tasks that are tracked, but not on this board. This is the useful half of the answer: it's
      // the list of work that could be pulled onto this board
      const tasksOnOtherBoards = await this.findTasksOnOtherBoards();
      if (Object.keys(tasksOnOtherBoards).length) {
        result.tasksOnOtherBoards = tasksOnOtherBoards;
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
          if (sprintIndex !== sprints.length - 1) {
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
        result.sprint.started = taskWorkloadInPeriod(tasks, startedField, sprintStartDate, sprintEndDate);
        result.sprint.completed = taskWorkloadInPeriod(tasks, completedField, sprintStartDate, sprintEndDate);
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
        result.period.started = taskWorkloadInPeriod(tasks, startedField, periodStart, periodEnd);
        result.period.completed = taskWorkloadInPeriod(tasks, completedField, periodStart, periodEnd);
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

    // Action rules are configuration: a rule that names an unknown event or verb is wrong in the
    // file, and an operation that meets one fails before writing anything, so it belongs here
    // rather than in the warnings
    try {
      const rules = await this.getActionRules(index);
      const context = { columns: Object.keys(index.columns) };
      if (await this.workspaceInitialised()) {
        context.boards = (await this.listBoards()).map((board) => board.slug);
      }
      for (const error of actions.findRuleErrors(rules, context)) {
        errors.push({ task: null, errors: `actions: ${error}` });
      }
    } catch (error) {
      errors.push({ task: null, errors: `actions: ${error.message}` });
    }
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
   * Validate every board in the workspace, and the tasks each of them references
   * @param {boolean} [save=false] Re-save each board and its tasks
   * @return {Promise<object[]|boolean>} A list of errors, or true if there were none
   */
  async validateAllBoards(save = false) {
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }
    const errors = [];
    for (const board of await this.listBoards()) {
      const result = await this.board(board.slug).validate(save);
      if (result !== true) {
        errors.push(...result.map((error) => ({ board: board.slug, ...error })));
      }
    }
    return errors.length ? errors : true;
  }

  /**
   * Check a workspace for multi-board problems. These are reported rather than thrown: every one of
   * them is a workspace that still works, just not the way its author probably meant it to
   * @return {Promise<object[]>} A list of warnings, each with a type, a message and the board it applies to
   */
  async findBoardWarnings() {
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }
    const warnings = [];
    const mainBoardSlug = await this.getMainBoardSlug();
    const boards = await this.listBoards();
    const boardSlugs = new Set(boards.map((board) => board.slug));
    const { exclude } = await this.getBoardsConfig();

    // Markdown files beside the boards that don't parse as one. These are ignored during ordinary
    // commands, which is the right default, but the user should be able to find out why
    const mainFolder = await this.getMainFolder();
    for (const filePath of await globMarkdown(mainFolder)) {
      const slug = boardSlugFromFileName(filePath);
      if (boardSlugs.has(slug)) {
        continue;
      }
      if (exclude.indexOf(slug) !== -1) {
        warnings.push({
          board: slug,
          type: "excluded-board",
          message: `"${path.basename(filePath)}" is excluded by the boards.exclude config and isn't treated as a board`
        });
        continue;
      }
      try {
        parseIndex.md2json(await fs.promises.readFile(filePath, { encoding: "utf-8" }));
      } catch (error) {
        warnings.push({
          board: slug,
          type: "unparseable-board",
          message: `"${path.basename(filePath)}" doesn't parse as a board and is being ignored: ${error.message}`
        });
      }
    }

    const stampingBoards = [];
    const knownBoards = new Set(boardSlugs);
    const taskBoardColumns = {};
    for (const board of boards) {
      let boardData = null;
      try {
        boardData = await this.loadBoard(board.slug);
      } catch (error) {
        continue;
      }

      // Workspace-scoped options in a secondary board's front matter are ignored, and silently
      // ignoring them would leave the user wondering why they had no effect
      if (board.slug !== mainBoardSlug) {
        const rawOptions = boardData.ownOptions || {};
        for (const key of Object.keys(rawOptions)) {
          if (WORKSPACE_SCOPED_OPTIONS.indexOf(key) !== -1) {
            warnings.push({
              board: board.slug,
              type: "workspace-scoped-option",
              message: `"${key}" is a workspace-scoped option and is ignored in a board file`
            });
          }
        }
      }

      // More than one board writing the same shared completed field means whichever board is touched
      // first silently owns that date for the whole workspace
      if ("completedColumns" in boardData.options && boardData.options.completedColumns.length) {
        stampingBoards.push({ slug: board.slug, field: getCompletedField(boardData) });
      }

      // Sprints are assumed to be in order: the last one is taken as the current sprint, and each
      // one runs until the next one starts
      const sprints = "sprints" in boardData.options ? boardData.options.sprints : [];
      for (let i = 1; i < sprints.length; i++) {
        if (new Date(sprints[i].start) < new Date(sprints[i - 1].start)) {
          warnings.push({
            board: board.slug,
            type: "sprints-out-of-order",
            message: `sprint "${sprints[i].name}" starts before "${sprints[i - 1].name}"`
          });
          break;
        }
      }

      // A task can only be in one column per board
      for (const [columnName, taskIds] of Object.entries(boardData.columns)) {
        for (const taskId of taskIds) {
          if (!(taskId in taskBoardColumns)) {
            taskBoardColumns[taskId] = {};
          }
          if (board.slug in taskBoardColumns[taskId]) {
            warnings.push({
              board: board.slug,
              type: "duplicate-task",
              message: `task "${taskId}" appears in both "${taskBoardColumns[taskId][board.slug]}" and "${columnName}"`
            });
          } else {
            taskBoardColumns[taskId][board.slug] = columnName;
          }
        }
      }
    }

    // Several boards stamping the same shared field
    const fields = {};
    for (const { slug, field } of stampingBoards) {
      if (!(field in fields)) {
        fields[field] = [];
      }
      fields[field].push(slug);
    }
    for (const [field, slugs] of Object.entries(fields)) {
      if (slugs.length > 1) {
        warnings.push({
          board: null,
          type: "multiple-stamping-authorities",
          message:
            `boards ${slugs.map((slug) => `"${slug}"`).join(", ")} all stamp "${field}" - ` +
            'whichever is touched first owns that date for every board'
        });
      }
    }

    // Tasks referenced by a board with no file behind them
    for (const [taskId, taskBoards] of Object.entries(taskBoardColumns)) {
      if (!(await this.taskFileExists(taskId))) {
        warnings.push({
          board: Object.keys(taskBoards)[0],
          type: "missing-task-file",
          message: `task "${taskId}" is referenced by ${Object.keys(taskBoards).join(", ")} but has no file`
        });
      }
    }

    // Tasks that no board references at all
    for (const taskId of await this.findWorkspaceUntrackedTasks()) {
      warnings.push({
        board: null,
        type: "untracked-task",
        message: `task "${taskId}" isn't on any board`
      });
    }

    // History events naming a board that has been deleted. These never match a board during replay,
    // so they're harmless - but they're the only trace a deleted board leaves behind
    const reportedBoards = new Set();
    for (const taskId of Object.keys(taskBoardColumns)) {
      let taskData = null;
      try {
        taskData = await this.loadTask(taskId);
      } catch (error) {
        continue;
      }
      for (const historyEvent of taskData.history || []) {
        if (historyEvent.board && !knownBoards.has(historyEvent.board) && !reportedBoards.has(historyEvent.board)) {
          reportedBoards.add(historyEvent.board);
          warnings.push({
            board: historyEvent.board,
            type: "unknown-board-in-history",
            message: `history events name board "${historyEvent.board}", which doesn't exist`
          });
        }
      }
    }
    return warnings;
  }

  /**
   * Collect every distinct value used in an `assigned` field or a comment `author` across the
   * workspace's task files, along with where each one is used
   *
   * Tasks are workspace-scoped - a task file can be referenced by several boards - so this reads the
   * task folder rather than any one board. Task files that don't parse are skipped: this is a
   * reporting helper, and `kanbn validate` is where a broken file gets reported
   * @return {Promise<Map<string, object>>} A map of value to usage entry
   */
  async collectContributorValues() {
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }
    const values = new Map();
    const record = (value, taskId, field) => {
      if (typeof value !== "string" || !value.trim()) {
        return;
      }
      const key = value.trim();
      if (!values.has(key)) {
        values.set(key, { value: key, assigned: 0, comments: 0, tasks: new Set() });
      }
      const entry = values.get(key);
      entry[field]++;
      entry.tasks.add(taskId);
    };
    for (const taskPath of await globMarkdown(await this.getTaskFolderPath())) {
      const taskId = path.parse(taskPath).name;
      let taskData = null;
      try {
        taskData = await this.loadTask(taskId);
      } catch (error) {
        continue;
      }
      record(getTaskMetadata(taskData, "assigned"), taskId, "assigned");
      for (const comment of taskData.comments || []) {
        record(comment.author, taskId, "comments");
      }
    }
    return values;
  }

  /**
   * Report how the workspace's contributors are actually used, and which names are in use that the
   * contributors list doesn't know about
   *
   * The second half is the point: adopting contributors in a workspace with 200 existing tasks
   * otherwise means grepping. This is read-only - rewriting "Gordon" to "gordon" across every task
   * file is a bulk mutation and belongs to its own command, with its own dry run
   * @return {Promise<{contributors: object[], unknown: object[]}>} Usage per known contributor, and
   * every value in use that isn't one
   */
  async getContributorUsage() {
    const contributors = await this.getContributors();
    const values = await this.collectContributorValues();
    const usage = contributors.map((contributor) => ({
      ...contributor,
      assigned: 0,
      comments: 0,
      tasks: new Set(),
      spellings: []
    }));
    const unknown = [];
    for (const entry of [...values.values()].sort((a, b) => a.value.localeCompare(b.value))) {
      const result = {
        value: entry.value,
        assigned: entry.assigned,
        comments: entry.comments,
        tasks: [...entry.tasks].sort()
      };
      const contributor = matchContributor(contributors, entry.value);
      if (contributor === null) {
        unknown.push(result);
        continue;
      }
      const target = usage.find((u) => u.name === contributor.name);
      target.assigned += entry.assigned;
      target.comments += entry.comments;

      // Counted as a set, so a task naming the same person twice under two spellings is one task
      for (const taskId of entry.tasks) {
        target.tasks.add(taskId);
      }
      target.spellings.push(result);
    }
    return {
      contributors: usage.map((contributor) => ({ ...contributor, tasks: contributor.tasks.size })),
      unknown
    };
  }

  /**
   * Find things about this board's action rules that are legal but probably not what the author meant
   *
   * Rules that are wrong in the file are errors, reported by validate(). These are the ones that
   * work: two rules writing the same field on the same event, or a rule using @me where no user can
   * be resolved
   * @return {Promise<object[]>} A list of warnings
   */
  async findActionWarnings() {
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    let rules = [];
    try {
      rules = await this.getActionRules();
    } catch (error) {
      // A rule set that can't be read is an error rather than a warning, and validate reports it
      return [];
    }
    if (!rules.length) {
      return [];
    }
    return actions.findRuleWarnings(rules, { hasUser: (await this.currentUser()) !== null });
  }

  /**
   * Find tasks whose assigned user or comment author isn't a known contributor
   *
   * Contributors are advisory, so this is a warning and never an error: `assigned` and `author` stay
   * free text, and a name that isn't in the list is written, read and filtered exactly as before.
   * Nothing is reported at all when the workspace declares no contributors
   * @return {Promise<object[]>} A list of warnings
   */
  async findContributorWarnings() {
    const contributors = await this.getContributors();
    if (!contributors.length) {
      return [];
    }
    const warnings = [];
    for (const entry of [...(await this.collectContributorValues()).values()].sort((a, b) =>
      a.value.localeCompare(b.value)
    )) {
      if (matchContributor(contributors, entry.value) !== null) {
        continue;
      }

      // A comment written by a rule is authored by the rule, not by a person, so it is never a
      // missing contributor
      if (entry.value === actions.ACTION_AUTHOR_PREFIX || entry.value.startsWith(`${actions.ACTION_AUTHOR_PREFIX}/`)) {
        continue;
      }
      for (const taskId of [...entry.tasks].sort()) {
        warnings.push({
          task: taskId,
          type: "unknown-contributor",
          value: entry.value,
          message: `"${entry.value}" isn't a known contributor`
        });
      }
    }
    return warnings;
  }

  /**
   * Find relations that don't point at a task
   *
   * Relations are keyed on task id, so a relation to a task that has been archived is still good -
   * restoring the task brings it straight back - and a relation to a task that's only on another
   * board is good too. What's reported is a relation to an id with no task file and no archived task
   * file, which nothing can follow, and a task related to itself, which nothing can mean
   * @return {Promise<object[]>} A list of warnings
   */
  async findRelationWarnings() {
    if (!(await this.workspaceInitialised())) {
      throw new Error("Not initialised in this folder");
    }
    const taskIds = new Set(
      (await globMarkdown(await this.getTaskFolderPath())).map((taskPath) => path.parse(taskPath).name)
    );
    const archivedTaskIds = new Set(
      (await globMarkdown(await this.getArchiveFolderPath())).map((taskPath) => path.parse(taskPath).name)
    );
    const warnings = [];
    for (const taskId of [...taskIds].sort()) {
      let taskData = null;
      try {
        taskData = await this.loadTask(taskId);
      } catch (error) {
        continue;
      }
      for (const relation of taskData.relations || []) {
        if (!relation || !relation.task) {
          continue;
        }
        const description = relation.type ? `${relation.type} ${relation.task}` : relation.task;
        if (relation.task === taskId) {
          warnings.push({
            task: taskId,
            type: "self-relation",
            relation,
            message: `"${description}" relates the task to itself`
          });
        } else if (!taskIds.has(relation.task) && !archivedTaskIds.has(relation.task)) {
          warnings.push({
            task: taskId,
            type: "missing-related-task",
            relation,
            message: `"${description}" points at a task that doesn't exist`
          });
        }
      }
    }
    return warnings;
  }

  /**
   * Find tasks whose started/completed dates disagree with the column they're in
   *
   * Task state comes from metadata dates only, so a task moved between columns by hand (by editing
   * the index file, or through a merge) won't have had its dates updated. This reports both
   * directions: a task sitting in a started or completed column with no date, and a task carrying a
   * completed date while sitting somewhere else
   * @return {Promise<object[]>} A list of drift entries
   */
  async findDateDrift() {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }
    const index = await this.loadIndex();
    const tasks = [];
    for (const taskId of getTrackedTaskIds(index)) {
      try {
        tasks.push(await this.loadTask(taskId));
      } catch (error) {
        // Unreadable tasks are reported by validate(), not here
      }
    }
    return this.getDateDrift(index, tasks);
  }

  /**
   * Find date drift in a list of tasks that have already been loaded
   * @param {object} index The index object
   * @param {object[]} tasks Loaded task objects
   * @return {object[]} A list of drift entries
   */
  getDateDrift(index, tasks) {
    const startedField = getStartedField(index);
    const completedField = getCompletedField(index);
    const startedColumns = "startedColumns" in index.options ? index.options.startedColumns : [];
    const completedColumns = "completedColumns" in index.options ? index.options.completedColumns : [];
    const drift = [];

    for (const task of tasks) {
      const column = findTaskColumn(index, task.id);

      // A task in a started or completed column with no date to say when that happened. The date is
      // usually recoverable from history, so these can be backfilled
      for (const [field, columns] of [[completedField, completedColumns], [startedField, startedColumns]]) {
        if (columns.indexOf(column) === -1 || field in task.metadata) {
          continue;
        }
        const historyDate = findColumnEntryDate(task, columns);
        const date = historyDate
          || ("updated" in task.metadata ? task.metadata.updated : null)
          || ("created" in task.metadata ? task.metadata.created : null);
        drift.push({
          task: task.id,
          column,
          field,
          issue: "missing",
          message: `task is in column "${column}" but has no ${field} date`,
          fixable: date !== null,
          date,
          source: date === null
            ? null
            : historyDate
              ? "history"
              : "updated" in task.metadata && task.metadata.updated === date
                ? "updated"
                : "created"
        });
      }

      // A task carrying a completed date while sitting outside the completed columns. This is left
      // alone: the date records something that really happened, and removing it would lose it
      if (
        completedColumns.length > 0 &&
        completedField in task.metadata &&
        completedColumns.indexOf(column) === -1
      ) {
        drift.push({
          task: task.id,
          column,
          field: completedField,
          issue: "unexpected",
          message: `task has a ${completedField} date but is in column "${column}"`,
          fixable: false,
          date: null,
          source: null
        });
      }
    }
    return drift;
  }

  /**
   * Check whether hints and notices should be shown for this board
   * @param {object} index The index object
   * @return {boolean} True if hints should be shown
   */
  isVerbose(index) {
    return !("verbose" in index.options) || index.options.verbose !== false;
  }

  /**
   * Backfill missing started/completed dates for tasks that are in a started or completed column
   * @return {Promise<object[]>} The drift entries that were fixed
   */
  async fixDateDrift() {
    const fixed = [];
    for (const item of (await this.findDateDrift()).filter((d) => d.fixable && d.issue === "missing")) {
      const task = await this.loadTask(item.task);
      setTaskMetadata(task, item.field, item.date);
      await this.saveTask(getTaskPath(await this.getTaskFolderPath(), item.task), task);
      fixed.push(item);
    }
    return fixed;
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

    // Sprints are workspace-level unless a board declares its own list. Adding a sprint from a
    // secondary board that hasn't declared one appends to the workspace list rather than quietly
    // forking it - a fork would be invisible and would freeze that board out of every future
    // workspace sprint. Creating a board-local list stays a deliberate front-matter edit
    const index = await this.loadIndex();
    const isMainBoard = await this.isMainBoard();
    const boardOwnsSprints = !isMainBoard && "sprints" in (index.ownOptions || {});
    const target = isMainBoard || boardOwnsSprints ? this : this.board(await this.getMainBoardSlug());
    const targetIndex = target === this ? index : await target.loadIndex();

    if (!("sprints" in targetIndex.options)) {
      targetIndex.options.sprints = [];
    }
    const sprintNumber = targetIndex.options.sprints.length + 1;
    const sprint = {
      start: start,
    };

    // If the name is blank, generate a default name. A board-local list prefixes the board name, so
    // that two boards generating their own "Sprint 1" can still be told apart
    if (!name) {
      sprint.name = boardOwnsSprints ? `${index.name} Sprint ${sprintNumber}` : `Sprint ${sprintNumber}`;
    } else {
      sprint.name = name;
    }

    // Add description if one exists
    if (description) {
      sprint.description = description;
    }

    // Add sprint and save the board that owns the list
    targetIndex.options.sprints.push(sprint);
    await target.saveIndex(targetIndex);

    // Tell the caller which list this went into, so the CLI can say so
    sprint.board = boardOwnsSprints ? await this.resolveBoardSlug() : null;
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

    // Burndown measures work in flight, which a board with no started columns has no notion of. An
    // empty chart looks like a bug, so say what's actually missing
    if (!("startedColumns" in index.options) || !index.options.startedColumns.length) {
      throw new Error(
        `Board "${await this.resolveBoardSlug()}" declares no startedColumns, so it has no notion of work in progress`
      );
    }
    const startedField = getStartedField(index);
    const completedField = getCompletedField(index);
    const tasks = [...(await this.loadAllTrackedTasks(index))]
      .map((task) => {
        const taskColumn = findTaskColumn(index, task.id);
        const created = "created" in task.metadata ? task.metadata.created : new Date(0);
        return {
          ...task,
          created,

          // A task's started and completed dates come from its metadata only. They used to fall back
          // to the task's created date whenever it sat in a started or completed column, which
          // invented timings that had nothing to do with when the work actually happened
          started: startedField in task.metadata ? task.metadata[startedField] : false,
          completed: completedField in task.metadata ? task.metadata[completedField] : false,
          progress: taskProgress(index, task),
          assigned: "assigned" in task.metadata ? task.metadata.assigned : null,
          workload: taskWorkload(index, task),
          column: taskColumn,
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
                    startedField in t.metadata && t.metadata[startedField],
                    completedField in t.metadata && (t.metadata[completedField] || new Date(8640000000000000))
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
          for (let sprint of sprints) {
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
        if ("history" in task && Array.isArray(task.history) && task.history.length > 0) {
          task.history = task.history.map((historyEvent) => ({
            ...historyEvent,
            date: historyEvent.date ? normaliseDate(historyEvent.date, normalise) : historyEvent.date
          }));
        }
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

    // Datapoints are placed and annotated from this board's history, so activity on another board
    // doesn't put markers on this board's chart
    const historyBoard = await this.historyBoard();

    // Get workload datapoints for each period
    series.forEach((s) => {
      s.dataPoints = [
        {
          x: s.from,
          y: getWorkloadAtDate(index, tasks, s.from),
          count: countActiveTasksAtDate(index, tasks, s.from),
          tasks: getTaskEventsAtDate(index, tasks, s.from, historyBoard),
        },
        ...tasks
          .map((task) => getTaskTimelineDates(task, s.from, s.to, historyBoard))
          .flat()
          .filter((d) => d)
          .map((x) => ({
            x,
            y: getWorkloadAtDate(index, tasks, x),
            count: countActiveTasksAtDate(index, tasks, x),
            tasks: getTaskEventsAtDate(index, tasks, x, historyBoard),
          })),
        {
          x: s.to,
          y: getWorkloadAtDate(index, tasks, s.to),
          count: countActiveTasksAtDate(index, tasks, s.to),
          tasks: getTaskEventsAtDate(index, tasks, s.to, historyBoard),
        },
      ].sort((a, b) => a.x.getTime() - b.x.getTime());
    });
    return { series };
  }

  /**
   * Get a chronological list of task events from metadata dates and structured task history
   * @param {?string[]} [sprints=null] The sprint names or numbers to include, or null for no sprint filter
   * @param {?Date[]} [dates=null] One or more dates to define a range filter, or null for no date filter
   * @param {?string} [assigned=null] The assigned user to filter for, or null for no assigned filter
   * @param {?string[]} [taskIds=null] One or more task ids to filter for, or null for no task id filter
   * @return {Promise<object>} A list of chronological task history events
   */
  async history(sprints = null, dates = null, assigned = null, taskIds = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    const index = await this.loadIndex();
    const selectedTaskIds = taskIds === null
      ? null
      : new Set(taskIds.map((taskId) => removeFileExtension(taskId)));

    // Show this board's history, plus the events that aren't board-scoped at all
    const historyBoard = await this.historyBoard();

    // Build date filter periods from sprints and/or dates
    const periods = [];
    const indexSprints = "sprints" in index.options && index.options.sprints.length ? index.options.sprints : null;
    if (sprints !== null) {
      if (indexSprints === null) {
        throw new Error("No sprints defined");
      }
      for (let sprint of sprints) {
        let sprintIndex = null;

        // Select sprint by number (1-based index)
        if (typeof sprint === "number") {
          if (sprint < 1 || sprint > indexSprints.length) {
            throw new Error(`Sprint ${sprint} does not exist`);
          }
          sprintIndex = sprint - 1;

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

        periods.push({
          type: "sprint",
          label: indexSprints[sprintIndex].name,
          from: new Date(indexSprints[sprintIndex].start),
          to: sprintIndex < indexSprints.length - 1
            ? new Date(indexSprints[sprintIndex + 1].start)
            : new Date(),
        });
      }
    }

    if (dates !== null) {
      periods.push({
        type: "date",
        from: new Date(Math.min(...dates)),
        to: dates.length === 1 ? new Date() : new Date(Math.max(...dates)),
      });
    }

    const includeEventDate = (date) => {
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return false;
      }
      if (periods.length === 0) {
        return true;
      }
      return periods.some((period) => date >= period.from && date <= period.to);
    };

    const buildBaseTask = (task) => ({
      id: task.id,
      name: task.name,
      assigned: getTaskMetadata(task, "assigned") || null,
      column: findTaskColumn(index, task.id),
    });

    const tasks = await this.loadAllTrackedTasks(index);
    let events = tasks
      .filter((task) => {
        const assignedUser = getTaskMetadata(task, "assigned") || null;
        return (
          (assigned === null || assignedUser === assigned) &&
          (selectedTaskIds === null || selectedTaskIds.has(task.id))
        );
      })
      .map((task) => {
        const taskBase = buildBaseTask(task);

        const metadataEvents = Object.entries(task.metadata)
          .filter(([, value]) => value instanceof Date)
          .map(([field, value]) => ({
            date: value,
            source: "metadata",
            eventType: field,
            task: taskBase,
            event: {
              field,
              value,
            },
          }));

        const historyEvents = ("history" in task && Array.isArray(task.history) ? task.history : [])
          .filter((historyEvent) => historyEvent.date instanceof Date)
          .filter((historyEvent) => historyEventOnBoard(historyEvent, historyBoard))
          .map((historyEvent) => {
            const event = { ...historyEvent };
            delete event.date;
            return {
              date: historyEvent.date,
              source: "history",
              eventType: historyEvent.type,
              task: taskBase,
              event,
            };
          });

        return [...metadataEvents, ...historyEvents];
      })
      .flat()
      .filter((event) => includeEventDate(event.date));

    events.sort((a, b) => compareValues(a.date, b.date) || compareValues(a.task.id, b.task.id));
    return { periods, events };
  }

  /**
   * Output gantt chart data
   * @param {?string} [assigned=null] The assigned user to filter for, or null for no assigned filter
   * @param {?string[]} [columns=null] The columns to filter for, or null for no column filter
  * @param {?Date[]} [dates=null] The dates to filter for (tasks created within range), or null for no date filter
  * @param {?Date} [now=null] Optional date to treat as the current time
   * @return {Promise<object>} Gantt chart data as an object
   */
  async gantt(assigned = null, columns = null, dates = null, now = null) {
    // Check if this folder has been initialised
    if (!(await this.initialised())) {
      throw new Error("Not initialised in this folder");
    }

    const effectiveNow = now instanceof Date ? now : new Date();

    // Get index and tasks
    const index = await this.loadIndex();
    const startedField = getStartedField(index);
    const completedField = getCompletedField(index);
    const tasks = [...(await this.loadAllTrackedTasks(index))]
      .map((task) => {
        const taskColumn = findTaskColumn(index, task.id);
        const created = "created" in task.metadata ? task.metadata.created : new Date(0);
        return {
          ...task,
          created,
          started: startedField in task.metadata ? task.metadata[startedField] : false,
          completed: completedField in task.metadata ? task.metadata[completedField] : false,
          plannedStart: "plannedStart" in task.metadata ? task.metadata.plannedStart : false,
          plannedFinish: "plannedFinish" in task.metadata ? task.metadata.plannedFinish : false,
          workload: taskWorkload(index, task),
          progress: taskProgress(index, task),
          column: taskColumn,
          assignedUser: "assigned" in task.metadata ? task.metadata.assigned : null,
        };
      })
      .filter(
        (task) => {
          // Filter by assigned user
          if (assigned !== null && task.assignedUser !== assigned) {
            return false;
          }
          // Filter by columns
          if (columns !== null && !columns.includes(task.column)) {
            return false;
          }
          // Filter by date range
          if (dates !== null && dates.length > 0) {
            const from = Math.min(...dates);
            const to = dates.length === 1 ? effectiveNow.getTime() : Math.max(...dates);
            if (task.created.getTime() < from || task.created.getTime() > to) {
              return false;
            }
          }
          return true;
        }
      );

    const trackedTaskIds = getTrackedTaskIds(index);
    return buildGanttSchedule(index, tasks, effectiveNow, trackedTaskIds);
  }

  /**
   * Add a comment to a task
   * @param {string} taskId The task id
   * @param {string} text The comment text
   * @param {string} author The comment author
   * @return {Promise<string>} The task id
   */
  async comment(taskId, text, author = "") {
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
    let taskData = await this.loadTask(taskId);
    const taskPath = getTaskPath(await this.getTaskFolderPath(), taskId);
    const now = new Date();
    taskData.comments.push({
      text,

      // An author is optional, and a machine with no resolvable user has none. Serialising null
      // fails schema validation, so the task could never be written back
      author: author || "",
      date: now,
    });

    // Run actions
    const result = await this.runActions({
      eventTypes: ["task.commented"],
      index,
      taskId,
      taskData,
      payload: { comment: text },
      date: now
    });
    if (result !== null) {
      ({ taskData } = result);
      index = result.index;
      if (result.patch.moveTo !== null) {
        const fromColumn = findTaskColumn(index, taskId);
        if (fromColumn !== result.patch.moveTo.column) {
          taskData = appendTaskHistory(
            taskData,
            { date: now, type: "moved", fromColumn, toColumn: result.patch.moveTo.column },
            await this.historyBoard(),
            result.patch.moveTo.author
          );
          index = removeTaskFromIndex(index, taskId);
          index = addTaskToIndex(index, taskId, result.patch.moveTo.column, result.patch.moveTo.position);
          taskData = updateColumnLinkedCustomFields(index, taskData, result.patch.moveTo.column, now);
        }
      }
    }

    // Save the task
    await this.saveTask(taskPath, taskData);

    // Commenting doesn't touch the index, so it is only written when a rule moved something
    if (result !== null && (result.patch.moveTo !== null || result.targets.some((target) => target.moveTo !== null))) {
      await this.saveIndex(index);
    }
    await this.completeActions(result, taskId);
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
    const files = await globMarkdown(archiveFolder);
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
    const taskColumn = findTaskColumn(index, taskId);
    taskData = setTaskMetadata(taskData, "column", taskColumn);

    // Archiving removes a task from every board, so remember where it was on each of them. The
    // single `column` key is kept for the main board, so archives written before boards existed -
    // and archives of tasks that are only on one board - are unchanged
    const taskBoards = await this.findTaskBoards(taskId);
    if (Object.keys(taskBoards).length > 1) {
      taskData = setTaskMetadata(taskData, "columns", taskBoards);
    }

    // Add history event. Archiving isn't board-scoped, so the event carries no board key
    const now = new Date();
    taskData = appendTaskHistory(taskData, {
      type: 'archived',
      fromColumn: taskColumn
    }, null, await this.currentUser());

    // Run actions
    const result = await this.runActions({
      eventTypes: ["task.archived"],
      index,
      taskId,
      taskData,
      payload: { fromColumn: taskColumn },
      date: now
    });
    if (result !== null) {
      ({ index, taskData } = result);
      if (result.targets.some((target) => target.moveTo !== null)) {
        await this.saveIndex(index);
      }
    }

    // Save the task inside the archive folder
    await this.saveTask(archivedTaskPath, taskData);
    await this.completeActions(result, taskId);

    // Remove the original task from every board that references it. This removal is part of the
    // archive rather than a deletion anyone wrote a rule for, so it fires nothing
    await this.withoutActions().deleteTask(taskId, true, true);

    return taskId;
  }

  /**
   * Restore a task from the archive
   * @param {string} taskId The task id
   * @param {?string} [columnName=null] The column to restore the task to
   * @param {boolean} [singleBoard=false] Restore only to this board, rather than to every board the
   * task was on when it was archived
   * @return {Promise<string>} The task id
   */
  async restoreTask(taskId, columnName = null, singleBoard = false) {
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

    // Work out which other boards this task was on when it was archived. A board that has since been
    // deleted is skipped with a warning rather than failing the restore
    const thisBoardSlug = await this.resolveBoardSlug();
    const archivedColumns = getTaskMetadata(taskData, "columns") || {};
    const otherBoards = [];
    const missingBoards = [];
    this.lastRestoreWarnings = [];
    if (!singleBoard) {
      for (const [slug, archivedColumn] of Object.entries(archivedColumns)) {
        if (slug === thisBoardSlug) {
          continue;
        }
        if (await this.boardExists(slug)) {
          otherBoards.push([slug, archivedColumn]);
        } else {
          missingBoards.push(slug);
        }
      }
    }
    taskData = setTaskMetadata(taskData, "column", undefined);
    if ("metadata" in taskData && "columns" in taskData.metadata) {
      taskData = setTaskMetadata(taskData, "columns", undefined);
    }

    // Stamp every date this call writes with the same timestamp, so that the history event and the
    // column-linked dates can't disagree by a millisecond
    const now = new Date();

    // Add history event
    taskData = appendTaskHistory(taskData, {
      date: now,
      type: 'restored',
      toColumn: actualColumnName
    }, null, await this.currentUser());

    // Update task metadata dates
    const beforeActions = { ...taskData, metadata: { ...taskData.metadata } };
    taskData = updateColumnLinkedCustomFields(index, taskData, actualColumnName, now);

    // Add the task to the column before running rules, so that a rule filtering on the task's
    // column sees the column it is being restored to
    index = addTaskToIndex(index, taskId, actualColumnName);

    // Run actions
    const result = await this.runActions({
      eventTypes: ["task.restored", ...this.derivedEvents(index, beforeActions, taskData)],
      index,
      taskId,
      taskData,
      payload: { toColumn: actualColumnName },

      // The task isn't on any board yet, so the index can't say which boards this affects
      taskBoards: [thisBoardSlug, ...otherBoards.map(([slug]) => slug)],
      date: now
    });
    if (result !== null) {
      ({ index, taskData } = result);
      if (result.patch.moveTo !== null && result.patch.moveTo.column !== actualColumnName) {
        actualColumnName = result.patch.moveTo.column;
        index = removeTaskFromIndex(index, taskId);
        index = addTaskToIndex(index, taskId, actualColumnName, result.patch.moveTo.position);
        taskData = updateColumnLinkedCustomFields(index, taskData, actualColumnName, now);
      }
    }
    await this.saveTask(taskPath, taskData);
    await this.saveIndex(index);
    await this.completeActions(result, taskId);

    // Restore the task to every other board it was on, falling back to that board's first column if
    // the column it used to be in has since gone
    for (const [slug, archivedColumn] of otherBoards) {
      const otherBoard = this.board(slug);
      const otherIndex = await otherBoard.loadIndex();
      const otherColumns = Object.keys(otherIndex.columns);
      if (!otherColumns.length) {
        missingBoards.push(slug);
        continue;
      }
      await otherBoard.addTaskToBoard(
        taskId,
        archivedColumn in otherIndex.columns ? archivedColumn : otherColumns[0]
      );
    }
    // Boards the task used to be on that no longer exist, for the caller to report. Restoring is
    // best-effort: a deleted board shouldn't stop the task coming back to the boards that remain
    this.lastRestoreWarnings = missingBoards;

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

// Preserve backward compatibility for existing callers that expect
// require('./main') to expose the Kanbn API directly.
const kanbn = new Kanbn();

module.exports = kanbn;
module.exports.Kanbn = Kanbn;
