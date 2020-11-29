const fs = require('fs');
const path = require('path');
const glob = require('glob-promise');
const parseIndex = require('./parse-index');
const parseTask = require('./parse-task');
const chrono = require('chrono-node');
const utility = require('./utility');

// TODO column archiving
//  if any columns are marked as 'archiveColumns' and archiveFile is in index options, get/set tasks from single json file

module.exports = (() => {
  const ROOT = process.cwd();
  const FOLDER_NAME = '.kanbn';
  const MAIN_FOLDER = path.join(ROOT, FOLDER_NAME);
  const INDEX = path.join(MAIN_FOLDER, 'index.md');
  const TASK_FOLDER = path.join(MAIN_FOLDER, 'tasks/');

  // Default fallback values for index options
  const DEFAULT_ARCHIVE_FILE = 'archive.json';
  const DEFAULT_TASK_WEIGHT = 2;
  const DEFAULT_TASK_WEIGHT_TAGS = {
    'Nothing': 0,
    'Tiny': 1,
    'Small': 2,
    'Medium': 3,
    'Large': 5,
    'Huge': 8
  };

  /**
   * Default options for the initialise command
   */
  const defaultInitialiseOptions = {
    name: 'Project Name',
    description: '',
    options: {
      completedColumns: [
        'Done'
      ]
    },
    columns: [
      'Backlog',
      'Todo',
      'In Progress',
      'Done'
    ]
  };

  /**
   * Check if a file or folder exists
   * @param {string} path
   * @return {boolean} True if the file or folder exists
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
   * Get a task path from the id
   * @param {string} taskId The task id
   * @return {string} The task path
   */
  function getTaskPath(taskId) {
    return path.join(TASK_FOLDER, addFileExtension(taskId));
  }

  /**
   * Add the file extension to an id if it doesn't already have one
   * @param {string} taskId The task id
   * @return {string} The task id with .md extension
   */
  function addFileExtension(taskId) {
    if (!(/\.md$/).test(taskId)) {
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
    if ((/\.md$/).test(taskId)) {
      return taskId.slice(0, taskId.length - '.md'.length);
    }
    return taskId;
  }

  /**
   * Get a list of all tracked task ids
   * @param {object} index The index object
   * @param {string} columnName The optional column name to filter tasks by
   * @return {Set} A set of task ids appearing in the index
   */
  function getTrackedTasks(index, columnName = null) {
    return new Set(
      columnName
        ? index.columns[columnName]
        : Object.keys(index.columns).map(columnName => index.columns[columnName]).flat()
    );
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
   * @return {object} The modified index object
   */
  function addTaskToIndex(index, taskId, columnName) {
    index.columns[columnName].push(taskId);
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
      index.columns[columnName] = index.columns[columnName].filter(t => t !== taskId);
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
      index.columns[columnName] = index.columns[columnName].map(t => t === taskId ? newTaskId : t);
    }
    return index;
  }

  /**
   * Set a metadata value in a task
   * @param {object} taskData The task object
   * @param {string} property The metadata property to update
   * @param {string} value The value to set
   * @return {object} The modified task object
   */
  function setTaskMetadata(taskData, property, value) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    taskData.metadata[property] = value;
    return taskData;
  }

  /**
   *
   * @param {object} index The index object
   * @param {string} columnName The column to sort
   * @param {string[]} filters A list of filters to sort by
   * @return {object} The modified index object
   */
  function sortColumnInIndex(index, columnName, filters) {
    // TODO sortColumnInIndex
  }

  /**
   * Overwrite the index file with the specified data
   * @param {object} indexData
   */
  async function saveIndex(indexData) {
    // TODO check for sorting options and sort the columns
    await fs.promises.writeFile(INDEX, parseIndex.json2md(indexData));
  }

  /**
   * Load the index file and parse it to an object
   * @return {object}
   */
  async function loadIndex() {
    let indexData = '';
    try {
      indexData = await fs.promises.readFile(INDEX, { encoding: 'utf-8' });
    } catch (error) {
      throw new Error(`Couldn't access index file: ${error}`);
    }
    return parseIndex.md2json(indexData);
  }

  /**
   * Overwrite a task file with the specified data
   * @param {string} path
   * @param {object} taskData
   */
  async function saveTask(path, taskData) {
    await fs.promises.writeFile(path, parseTask.json2md(taskData));
  }

  /**
   * Load a task file and parse it to an object
   * @param {string} taskId
   */
  async function loadTask(taskId) {
    const TASK = path.join(TASK_FOLDER, addFileExtension(taskId));
    let taskData = '';
    try {
      taskData = await fs.promises.readFile(TASK, { encoding: 'utf-8' });
    } catch (error) {
      throw new Error(`Couldn't access task file: ${error}`);
    }
    return parseTask.md2json(taskData);
  }

  /**
   * Load all tracked tasks and return an array of task objects
   * @param {object} index The index object
   * @param {string} columnName The optional column name to filter tasks by
   * @return {object[]} All tracked tasks
   */
  async function loadAllTrackedTasks(index, columnName = null) {
    const result = [];
    const trackedTasks = getTrackedTasks(index, columnName);
    for (let taskId of trackedTasks) {
      result.push(await loadTask(taskId));
    }
    return result;
  }

  /**
   * Check if the input string contains the filter string, or if the filter string is a regex (starts and ends
   * with the '/' character), check if the input string matches against the filter regex
   * @param {string|string[]} filter A substring or regex
   * @param {string} input The string to match against
   * @return {boolean} True if the input matches the string filter
   */
  function stringFilter(filter, input) {
    if (Array.isArray(filter)) {
      filter = `/${filter.map(utility.trimRegex).join('|')}/`;
    }
    if (filter.startsWith('/') && filter.endsWith('/')) {
      return (new RegExp(utility.trimRegex(filter))).test(input);
    }
    return input.includes(filter);
  }

  /**
   * Check if the input date matches a date (ignore time part), or if multiple dates are passed in, check if the
   * input date is between the earliest and latest dates
   * @param {string[]} dates A list of dates to check against
   * @param {Date} input The input date to match against
   * @return {boolean} True if the input matches the date filter
   */
  function dateFilter(dates, input) {
    if (!Array.isArray(dates)) {
      dates = [dates];
    }
    dates = dates.map(date => {
      const parsedDate = chrono.parseDate(date);
      if (parsedDate === null) {
        throw new Error('Unable to parse date');
      }
      return parsedDate;
    });
    if (dates.length === 1) {
      return utility.compareDates(input, dates[0]);
    }
    const earliest = Math.min.apply(null, dates);
    const latest = Math.max.apply(null, dates);
    return input >= earliest && input <= latest;
  }

  /**
   * Check if the input matches a count, or if multiple counts are passed in, check if the input is between the
   * minimum and maximum counts
   * @param {string|string[]} filter A filter string or array of filter strings, should be numeric
   * @param {string} input The count to match against
   * @return {boolean} True if the input matches the string filter
   */
  function countFilter(filter, input) {
    filter = (Array.isArray(filter) ? filter : [filter]).map(parseInt);
    input = parseInt(input);
    return input >= Math.min(...filter) && input <= Math.max(...filter);
  }

  return {

    /**
     * Get the kanbn folder location for the current working directory
     * @return {string} The kanbn folder path
     */
    getMainFolder() {
      return MAIN_FOLDER;
    },

    /**
     * Get the index from index.md as an object
     * @return {object} The index
     */
    async getIndex() {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      return loadIndex();
    },

    /**
     * Get a task as an object
     * @param {string} taskId The task id to get
     * @return {object} The task
     */
    async getTask(taskId) {
      this.taskExists(taskId);
      return loadTask(taskId);
    },

    /**
     * Check if the current working directory has been initialised
     * @return {boolean} True if the current working directory has been initialised, otherwise false
     */
    async initialised() {
      return await exists(INDEX);
    },

    /**
     * Initialise a kanbn board in the current working directory
     * @param {object} options Initial columns and other config options
     */
    async initialise(options = {}) {

      // Create main folder if it doesn't already exist
      if (!await exists(MAIN_FOLDER)) {
        await fs.promises.mkdir(MAIN_FOLDER, { recursive: true });
      }

      // Create tasks folder if it doesn't already exist
      if (!await exists(TASK_FOLDER)) {
        await fs.promises.mkdir(TASK_FOLDER, { recursive: true });
      }

      // Create index if one doesn't already exist
      let index;
      if (!await exists(INDEX)) {
        const opts = Object.assign({}, defaultInitialiseOptions, options);
        index = {
          name: opts.name,
          description: opts.description,
          options: opts.options,
          columns: Object.fromEntries(opts.columns.map(columnName => [columnName, []]))
        };

      // Otherwise, if index already exists and we have specified new settings, re-write the index file
      } else if (Object.keys(options).length > 0) {
        index = await loadIndex();
        'name' in options && (index.name = options.name);
        'description' in options && (index.description = options.description);
        'options' in options && (index.options = Object.assign(index.options, options.options));
        'columns' in options && (index.columns = Object.assign(
          index.columns,
          Object.fromEntries(options.columns.map(
            columnName => [columnName, columnName in index.columns ? index.columns[columnName] : []]
          ))
        ));
      }
      await saveIndex(index);
    },

    /**
     * Check if a task file exists and is in the index, otherwise throw an error
     * @param {string} taskId The task id to check
     */
    async taskExists(taskId) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Check if the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Check that the task is indexed
      let index = await loadIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`No task with id "${taskId}" found in the index`);
      }
    },

    /**
     * Get the column that a task is in or throw an error if the task doesn't exist or isn't indexed
     * @param {string} taskId The task id to find
     */
    async findTaskColumn(taskId) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Check if the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Check that the task is indexed
      let index = await loadIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`No task with id "${taskId}" found in the index`);
      }

      // Find which column the task is in
      return findTaskColumn(index, taskId);
    },

    /**
     * Create a task file and add the task to the index
     * @param {object} taskData The task object
     * @param {string} columnName The name of the column to add the task to
     * @return {string} The id of the task that was created
     */
    async createTask(taskData, columnName) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Make sure the task has a name
      if (!taskData.name) {
        throw new Error('Task name cannot be blank');
      }

      // Make sure a task doesn't already exist with the same name
      const taskId = utility.getTaskId(taskData.name);
      const taskPath = getTaskPath(taskId);
      if (await exists(taskPath)) {
        throw new Error(`A task with id "${taskId}" already exists`);
      }

      // Get index and make sure the column exists
      let index = await loadIndex();
      if (!(columnName in index.columns)) {
        throw new Error(`Column "${columnName}" doesn't exist`);
      }

      // Check that a task with the same id isn't already indexed
      if (taskInIndex(index, taskId)) {
        throw new Error(`A task with id "${taskId}" is already in the index`);
      }

      // Set the created date
      taskData = setTaskMetadata(taskData, 'created', (new Date()).toISOString());

      // If we're creating the task in a completed column, set the task's completed date
      if ('completedColumns' in index.options && index.options.completedColumns.indexOf(columnName) !== -1) {
        taskData = setTaskMetadata(taskData, 'completed', (new Date()).toISOString());
      }
      await saveTask(taskPath, taskData);

      // Add the task to the index
      index = addTaskToIndex(index, taskId, columnName);
      await saveIndex(index);

      return taskId;
    },

    /**
     * Add an untracked task to the specified column in the index
     * @param {string} taskId
     * @param {string} columnName
     * @return {string} The id of the task that was added
     */
    async addUntrackedTaskToIndex(taskId, columnName) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Make sure the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Get index and make sure the column exists
      let index = await loadIndex();
      if (!(columnName in index.columns)) {
        throw new Error(`Column "${columnName}" doesn't exist`);
      }

      // Check that the task isn't already indexed
      if (taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is already in the index`);
      }

      // Add the task to the column and save the index
      index = addTaskToIndex(index, taskId, columnName);
      await saveIndex(index);

      return taskId;
    },

    /**
     * Get a list of tracked tasks (i.e. tasks that are listed in the index)
     * @param {string} columnName The optional column name to filter tasks by
     * @return {Set} A set of task ids
     */
    async findTrackedTasks(columnName = null) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Get all tasks currently in index
      const index = await loadIndex();
      return getTrackedTasks(index, columnName);
    },

    /**
     * Get a list of untracked tasks (i.e. markdown files in the tasks folder that aren't listed in the index)
     * @return {Set} A set of untracked task ids
     */
    async findUntrackedTasks() {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Get all tasks currently in index
      const index = await loadIndex();
      const trackedTasks = getTrackedTasks(index);

      // Get all tasks in the tasks folder
      const files = await glob(`${TASK_FOLDER}/*.md`);
      const untrackedTasks = new Set(files.map(task => path.parse(task).name));

      // Return the set difference
      return new Set([...untrackedTasks].filter(x => !trackedTasks.has(x)));
    },

    /**
     * Update an existing task
     * @param {string} taskId The id of the task to update
     * @param {object} taskData The new task data
     * @param {?string} columnName The column name to move this task to, or null if not moving this task
     * @return {string} The id of the task that was updated
     */
    async updateTask(taskId, taskData, columnName = null) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Make sure the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Get index and make sure the task is indexed
      let index = await loadIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }

      // Make sure the updated task data has a name
      if (!taskData.name) {
        throw new Error('Task name cannot be blank');
      }

      // Rename the task if we're updating the name
      const originalTaskData = await loadTask(taskId);
      if (originalTaskData.name !== taskData.name) {
        taskId = await this.renameTask(taskId, taskData.name);

        // Re-load the index
        index = await loadIndex();
      }

      // Get index and make sure the column exists
      if (columnName && !(columnName in index.columns)) {
        throw new Error(`Column "${columnName}" doesn't exist`);
      }

      // Set the updated date
      taskData = setTaskMetadata(taskData, 'updated', (new Date()).toISOString());

      // Save task
      await saveTask(getTaskPath(taskId), taskData);

      // Move the task if we're updating the column
      if (columnName) {
        await this.moveTask(taskId, columnName);

      // Otherwise save the index
      } else {
        await saveIndex(index);
      }

      return taskId;
    },

    /**
     * Change a task name, rename the task file and update the task id in the index
     * @param {string} taskId The id of the task to rename
     * @param {string} newTaskName The new task name
     * @return {string} The new id of the task that was renamed
     */
    async renameTask(taskId, newTaskName) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Get index and make sure the task is indexed
      let index = await loadIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }

      // Make sure the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Make sure there isn't already a task with the new task id
      const newTaskId = utility.getTaskId(newTaskName);
      const newTaskPath = getTaskPath(newTaskId);
      if (await exists(newTaskPath)) {
        throw new Error(`A task with id "${newTaskId}" already exists`);
      }

      // Check that a task with the new id isn't already indexed
      if (taskInIndex(index, newTaskId)) {
        throw new Error(`A task with id "${newTaskId}" is already in the index`);
      }

      // Update the task name and updated date
      let taskData = await loadTask(taskId);
      taskData.name = newTaskName;
      taskData = setTaskMetadata(taskData, 'updated', (new Date()).toISOString());
      await saveTask(getTaskPath(taskId), taskData);

      // Rename the task file
      await fs.promises.rename(getTaskPath(taskId), newTaskPath);

      // Update the task id in the index
      index = renameTaskInIndex(index, taskId, newTaskId);
      await saveIndex(index);

      return newTaskId;
    },

    /**
     * Move a task from one column to another column
     * @param {string} taskId The task id to move
     * @param {string} columnName The name of the column that the task will be moved to
     * @return {string} The id of the task that was moved
     */
    async moveTask(taskId, columnName) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Get index and make sure the task is indexed
      let index = await loadIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }

      // Make sure the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Make sure the target column exists
      if (!(columnName in index.columns)) {
        throw new Error(`Column "${columnName}" doesn't exist`);
      }

      // Update the task's updated date
      let taskData = await loadTask(taskId);
      taskData = setTaskMetadata(taskData, 'updated', (new Date()).toISOString());

      // If we're moving the task into a completed column, update the task's completed date
      if ('completedColumns' in index.options && index.options.completedColumns.indexOf(columnName) !== -1) {
        taskData = setTaskMetadata(taskData, 'completed', (new Date()).toISOString());
      }
      await saveTask(getTaskPath(taskId), taskData);

      // Remove the task from its current column and add it to the new column
      index = removeTaskFromIndex(index, taskId);
      index = addTaskToIndex(index, taskId, columnName);
      await saveIndex(index);

      return taskId;
    },

    /**
     * Remove a task from the index and optionally delete the task file as well
     * @param {string} taskId The id of the task to remove
     * @param {boolean} removeFile True if the task file should be removed
     * @return {string} The id of the task that was deleted
     */
    async deleteTask(taskId, removeFile = false) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Get index and make sure the task is indexed
      let index = await loadIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }

      // Remove the task from whichever column it's in
      index = removeTaskFromIndex(index, taskId);

      // Optionally remove the task file as well
      if (removeFile && await exists(getTaskPath(taskId))) {
        await fs.promises.unlink(getTaskPath(taskId));
      }
      await saveIndex(index);

      return taskId;
    },

    /**
     * Search for indexed tasks
     * @param {object} filters The filters to apply
     * @param {boolean} quiet Only return task ids if true, otherwise return full task details
     * @return {object[]} A list of tasks that match the filters
     */
    async search(filters = {}, quiet = false) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Load all tracked tasks and filter the results
      const index = await loadIndex();
      const tasks = [...await loadAllTrackedTasks(index)].filter(task => {

        // Get task id
        const taskId = utility.getTaskId(task.name);

        // If no filters are defined, return all tasks
        if (Object.keys(filters).length === 0) {
          return true;
        }

        // Apply filters
        let result = true;

        // Id
        if ('id' in filters && !stringFilter(filters.id, task.id)) {
          result = false;
        }

        // Name
        if ('name' in filters && !stringFilter(filters.name, task.name)) {
          result = false;
        }

        // Description
        if ('description' in filters && !stringFilter(filters.description, task.description)) {
          result = false;
        }

        // Column
        if ('column' in filters) {
          const columns = typeof filters.column === 'string' ? [filters.column] : filters.column;
          if (columns.indexOf(findTaskColumn(index, taskId)) === -1) {
            result = false;
          }
        }

        // Created date
        if (
          'created' in filters && (
            !('created' in task.metadata) ||
            !dateFilter(filters.created, task.metadata.created)
          )
        ) {
          result = false;
        }

        // Updated date
        if (
          'updated' in filters && (
            !('updated' in task.metadata) ||
            !dateFilter(filters.updated, task.metadata.updated)
          )
        ) {
          result = false;
        }

        // Completed
        if (
          'completed' in filters && (
            !('completed' in task.metadata) ||
            !dateFilter(filters.completed, task.metadata.completed)
          )
        ) {
          result = false;
        }

        // Due
        if (
          'due' in filters && (
            !('due' in task.metadata) ||
            !dateFilter(filters.due, task.metadata.due)
          )
        ) {
          result = false;
        }

        // Sub-tasks
        if (
          'sub-task' in filters &&
          !stringFilter(
            filters['sub-task'],
            task.subTasks.map(subTask => `[${subTask.completed ? 'x' : ''}] ${subTask.text}`).join('\n')
          )
        ) {
          result = false;
        }

        // Count sub-tasks
        if (
          'count-sub-tasks' in filters &&
          !countFilter(
            filters['count-sub-tasks'],
            task.subTasks.length
          )
        ) {
          result = false;
        }

        // Tag
        if (
          'tag' in filters &&
          !stringFilter(
            filters.tag,
            task.metadata.tags.join('\n')
          )
        ) {
          result = false;
        }

        // Count tags
        if (
          'count-tags' in filters &&
          !countFilter(
            filters['count-tags'],
            task.tags.length
          )
        ) {
          result = false;
        }

        // Relation
        if (
          'relation' in filters &&
          !stringFilter(
            filters.relation,
            task.relations.map(relation => `${relation.type} ${relation.task}`).join('\n')
          )
        ) {
          result = false;
        }

        // Count relations
        if (
          'count-relations' in filters &&
          !countFilter(
            filters['count-relations'],
            task.relations.length
          )
        ) {
          result = false;
        }
        return result;
      });

      // Return resulting task ids or the full tasks
      return tasks.map(task => {
        return quiet ? utility.getTaskId(task.name) : task;
      });
    },

    /**
     * Output project status information
     * @param {boolean} quiet Output full or partial status information
     * @return {object} Project status information as an object
     */
    async status(quiet = false) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Get index and column names
      const index = await loadIndex();
      const columnNames = Object.keys(index.columns);

      // Get basic project status information
      const result = {
        totalTasks: columnNames.reduce((a, v) => a + index.columns[v].length, 0),
        columnTotals: Object.fromEntries(columnNames.map(columnName => [
          columnName,
          index.columns[columnName].length
        ]))
      };

      // If required, load more detailed task information
      if (!quiet) {

        // Get task weights from index or defaults
        const defaultTaskWeight = 'defaultTaskWeight' in index.options
          ? index.options.defaultTaskWeight
          : DEFAULT_TASK_WEIGHT;
        const taskWeightTags = 'taskWeightTags' in index.options
          ? index.options.taskWeightTags
          : DEFAULT_TASK_WEIGHT_TAGS;

        // Load all tracked tasks
        const tasks = [...await loadAllTrackedTasks(index)];

        // Calculate workload for each task
        tasks.forEach(task => {
          let weight = 0;
          let hasWeightTags = false;
          if ('tags' in task.metadata) {
            for (let weightTag of Object.keys(taskWeightTags)) {
              if (task.metadata.tags.indexOf(weightTag)) {
                weight += taskWeightTags[weightTag];
                hasWeightTags = true;
              }
            }
          }
          if (!hasWeightTags) {
            weight = defaultTaskWeight;
          }
          task.weight = weight;
        });

        // Create workload total and total per column

        // Calculate workload of tasks created this sprint

        // Calculate workload of tasks completed this sprint

        // TODO finish kanbn.status non-quiet
      }

      return result;
    },

    /**
     * Validate the index and task files
     * @return {boolean} True if everything validated, otherwise an array of parsing errors
     */
    async validate() {
      // TODO kanbn.validate
    },

    /**
     * Sort a column in the index
     * @param {string} columnName The column name to sort
     * @param {string[]} filters Sort filters to apply
     * @param {boolean} desc Descending order
     */
    async sort(columnName, filters, desc) {
      // TODO kanbn.sort
      // save sorting in index options
    },

    /**
     * Nuke it from orbit, it's the only way to be sure
     */
    async nuclear() {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      await fs.promises.rmdir(MAIN_FOLDER, { recursive: true });
    }
  }
})();
