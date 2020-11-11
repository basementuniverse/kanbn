const fs = require('fs');
const path = require('path');
const glob = require('glob-promise');
const taskId = require('param-case');
const parseIndex = require('./parse-index');
const parseTask = require('./parse-task');
const utility = require('./utility');

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
      ]
    },
    columns: [
      'Backlog',
      'Todo',
      'In Progress',
      'Done',
      'Archive'
    ]
  };

  async function exists(path) {
    try {
      await fs.promises.access(path, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      return false;
    }
    return true;
  }

  function getTaskPathFromTitle(title) {
    return path.join(TASK_FOLDER, taskId.paramCase(title), '.md');
  }

  return {

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
          columns: Object.fromEntries(opts.columns.map(column => [column, []]))
        };
        await fs.promises.writeFile(INDEX, parseIndex.jsonToIndex(index));

      // Otherwise, if index already exists and we have specified new settings, re-write the index file
      } else if (Object.keys(options).length > 0) {
        index = await this.getIndex();
        'title' in options && (index.title = options.title);
        'description' in options && (index.description = options.description);
        'options' in options && (index.options = Object.assign(index.options, options.options));
        'columns' in options && (index.columns = Object.assign(
          index.columns,
          Object.fromEntries(options.columns.map(
            column => [column, column in index.columns ? index.columns[column] : []]
          ))
        ));
        await fs.promises.writeFile(INDEX, parseIndex.jsonToIndex(index));
      }
    },

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
        throw new Error(`Couldn't access index file: ${INDEX}: ${error}`);
      }
      return parseIndex.indexToJson(indexData);
    },

    /**
     * Get a task as an object
     * @param {string} id The task id to get
     * @return {object} The task
     */
    async getTask(id) {
      const TASK = path.join(TASK_FOLDER, id, '.md');
      let taskData = '';
      try {
        taskData = await fs.promises.readFile(TASK, { encoding: 'utf-8' });
      } catch (error) {
        throw new Error(`Couldn't access task file: ${TASK}: ${error}`);
      }
      return parseTask.taskToJson(taskData);
    },

    /**
     * Check if there is already a task file with the same filename (as generated from the title)
     * @param {string} title
     * @return {boolean} True if a task already exists with the same filename
     */
    async taskTitleExists(title) {
      return await exists(getTaskPathFromTitle(title));
    },

    async createTask(taskData) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    /**
     * Get a list of untracked tasks (i.e. markdown files in the tasks folder that aren't listen in the index)
     * @return {string[]} A list of untracked task ids/filenames
     */
    async findUntrackedTasks() {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }

      // Get all tasks currently in index
      const index = await this.getIndex();
      const trackedTasks = new Set([].concat.apply(...Object.keys(index.columns).map(column => index.columns[column])));

      // Get all tasks in the tasks folder
      const files = await glob(`${TASK_FOLDER}/*.md`);
      const untrackedTasks = new Set(files.map(task => path.parse(task).name));

      return new Set([...untrackedTasks].filter(x => !trackedTasks.has(x)));
    },

    async addUntrackedTask(taskData, column = null) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      await utility.sleep(3);
    },

    async updateTask(id, taskData) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    async deleteTask(id) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    async moveTask(id, column) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    async search(filters = []) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    async status() {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    async burndown(start, end) {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    /**
     * Nuke it from orbit, it's the only way to be sure
     */
    async nuclear() {
      if (!await this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      await fs.promises.rmdir(MAIN_FOLDER, { recursive: true });
    }
  }
})();
