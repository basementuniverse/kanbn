const fs = require('fs');
const path = require('path');
const glob = require('glob-promise');
const paramCase = require('param-case').paramCase;
const parseIndex = require('./parse-index');
const parseTask = require('./parse-task');

module.exports = (() => {
  const ROOT = process.cwd();
  const FOLDER_NAME = '.kanbn';
  const MAIN_FOLDER = path.join(ROOT, FOLDER_NAME);
  const INDEX = path.join(MAIN_FOLDER, 'index.md');
  const TASK_FOLDER = path.join(MAIN_FOLDER, 'tasks/');

  /**
   * Default options for the initialise command
   */
  const defaultInitialiseOptions = {
    title: 'Project Title',
    description: '',
    options: {
      hiddenColumns: [
        'Archive'
      ],
      archiveColumns: [
        'Archive'
      ],
      completedColumns: [
        'Done'
      ],
      archiveFile: 'archive.json',
      cache: true,
      cacheFile: 'cache.json'
    },
    columns: [
      'Backlog',
      'Todo',
      'In Progress',
      'Done',
      'Archive'
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
   * Get a task id from the title
   * @param {string} title The task title
   * @return {string} The task id
   */
  function getTaskId(title) {
    return paramCase(title);
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
   * @return {Set} A set of task ids appearing in the index
   */
  function getTrackedTasks(index) {
    return new Set([].concat.apply(...Object.keys(index.columns).map(columnName => index.columns[columnName])));
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
   * Overwrite the index file with the specified data
   * @param {object} indexData
   */
  async function saveIndex(indexData) {
    await fs.promises.writeFile(INDEX, parseIndex.json2md(indexData));
  }

  /**
   * Overwrite a task file with the specified data
   * @param {string} path
   * @param {object} taskData
   */
  async function saveTask(path, taskData) {
    await fs.promises.writeFile(path, parseTask.json2md(taskData));
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
      let indexData = '';
      try {
        indexData = await fs.promises.readFile(INDEX, { encoding: 'utf-8' });
      } catch (error) {
        throw new Error(`Couldn't access index file: ${error}`);
      }
      return parseIndex.md2json(indexData);
    },

    /**
     * Get a task as an object
     * @param {string} taskId The task id to get
     * @return {object} The task
     */
    async getTask(taskId) {
      const TASK = path.join(TASK_FOLDER, addFileExtension(taskId));
      let taskData = '';
      try {
        taskData = await fs.promises.readFile(TASK, { encoding: 'utf-8' });
      } catch (error) {
        throw new Error(`Couldn't access task file: ${error}`);
      }
      return parseTask.md2json(taskData);
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
          title: opts.title,
          description: opts.description,
          options: opts.options,
          columns: Object.fromEntries(opts.columns.map(columnName => [columnName, []]))
        };

      // Otherwise, if index already exists and we have specified new settings, re-write the index file
      } else if (Object.keys(options).length > 0) {
        index = await this.getIndex();
        'title' in options && (index.title = options.title);
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
     * Create a task file and add the task to the index
     * @param {object} taskData The task object
     * @param {string} columnName The name of the column to add the task to
     * @return {string} The task id
     */
    async createTask(taskData, columnName) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Make sure the task has a title
      if (!taskData.title) {
        throw new Error('Task title cannot be blank');
      }

      // Make sure a task doesn't already exist with the same title
      const taskId = getTaskId(taskData.title);
      const taskPath = getTaskPath(taskId);
      if (await exists(taskPath)) {
        throw new Error(`A task with id "${taskId}" already exists`);
      }

      // Get index and make sure the column exists
      let index = await this.getIndex();
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
      let index = await this.getIndex();
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
    },

    /**
     * Get a list of tracked tasks (i.e. tasks that are listed in the index)
     * @return {Set} A set of task ids
     */
    async findTrackedTasks() {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }

      // Get all tasks currently in index
      const index = await this.getIndex();
      return getTrackedTasks(index);
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
      const index = await this.getIndex();
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
      let index = await this.getIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }

      // Make sure the updated task data has a title
      if (!taskData.title) {
        throw new Error('Task title cannot be blank');
      }

      // Rename the task if we're updating the title
      const originalTaskData = await this.getTask(taskId);
      if (originalTaskData.title !== taskData.title) {
        taskId = await this.renameTask(taskId, taskData.title);
      }

      // Get index and make sure the column exists
      if (!(columnName in index.columns)) {
        throw new Error(`Column "${columnName}" doesn't exist`);
      }

      // Set the updated date
      taskData = setTaskMetadata(taskData, 'updated', (new Date()).toISOString());

      // Save task
      await saveTask(getTaskPath(taskId), taskData);

      // Move the task if we're updating the column
      if (columnName) {
        await this.moveTask(taskId, columnName);
      }

      return taskId;
    },

    /**
     * Change a task title, rename the task file and update the task id in the index
     * @param {string} taskId The id of the task to rename
     * @param {string} newTaskTitle The new task title
     */
    async renameTask(taskId, newTaskTitle) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Get index and make sure the task is indexed
      let index = await this.getIndex();
      if (!taskInIndex(index, taskId)) {
        throw new Error(`Task "${taskId}" is not in the index`);
      }

      // Make sure the task file exists
      if (!await exists(getTaskPath(taskId))) {
        throw new Error(`No task file found with id "${taskId}"`);
      }

      // Make sure there isn't already a task with the new task id
      const newTaskId = getTaskId(newTaskTitle);
      const newTaskPath = getTaskPath(newTaskId);
      if (await exists(newTaskPath)) {
        throw new Error(`A task with id "${newTaskId}" already exists`);
      }

      // Check that a task with the new id isn't already indexed
      if (taskInIndex(index, newTaskId)) {
        throw new Error(`A task with id "${newTaskId}" is already in the index`);
      }

      // Update the task title and updated date
      let taskData = this.getTask(taskId);
      taskData.title = newTaskTitle;
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
     * Remove a task from the index and optionally delete the task file as well
     * @param {string} taskId The id of the task to remove
     * @param {boolean} removeFile True if the task file should be removed
     */
    async deleteTask(taskId, removeFile = false) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Get index and make sure the task is indexed
      let index = await this.getIndex();
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
    },

    /**
     * Move a task from one column to another column
     * @param {string} taskId The task id to move
     * @param {string} columnName The name of the column that the task will be moved to
     */
    async moveTask(taskId, columnName) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      taskId = removeFileExtension(taskId);

      // Get index and make sure the task is indexed
      let index = await this.getIndex();
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
      let taskData = this.getTask(taskId);
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
    },

    async search(filters = []) {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      // TODO search
    },

    async status() {

      // Check if this folder has been initialised
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder');
      }
      // TODO status
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
