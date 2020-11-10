const fs = require('fs');
const path = require('path');
const glob = require('glob');
const taskId = require('param-case');
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

  /**
   * Check if a file or folder exists
   * @param {string} path
   * @return {boolean} True if the file or folder exists, otherwise false
   */
  function exists(path) {
    try {
      fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      return false;
    }
    return true;
  }

  return {

    /**
     * Check if the current working directory has been initialised
     * @return {boolean} True if the current working directory has been initialised, otherwise false
     */
    initialised() {
      return exists(MAIN_FOLDER) && exists(INDEX);
    },

    /**
     * Initialise a kanbn board in the current working directory
     * @param {object} options Initial columns and other config options
     */
    initialise(options = {}) {
      // Create main folder if it doesn't already exist
      if (!exists(MAIN_FOLDER)) {
        fs.mkdirSync(MAIN_FOLDER, { recursive: true });
      }

      // Create tasks folder if it doesn't already exist
      if (!exists(TASK_FOLDER)) {
        fs.mkdirSync(TASK_FOLDER, { recursive: true });
      }

      // Create index if one doesn't already exist
      let index;
      const indexExists = exists(INDEX);
      if (!indexExists) {
        const opts = Object.assign({}, defaultInitialiseOptions, options);
        index = {
          title: opts.title,
          description: opts.description,
          options: opts.options,
          columns: Object.fromEntries(opts.columns.map(column => [column, []]))
        };
        fs.writeFileSync(INDEX, parseIndex.jsonToIndex(index));

      // Otherwise, if index already exists and we have specified new settings, re-write the index file
      } else if (Object.keys(options).length > 0) {
        index = this.getIndex();
        'title' in options && (index.title = options.title);
        'description' in options && (index.description = options.description);
        'options' in options && (index.options = Object.assign(index.options, options.options));
        'columns' in options && (index.columns = Object.assign(
          index.columns,
          Object.fromEntries(options.columns.map(
            column => [column, column in index.columns ? index.columns[column] : []]
          ))
        ));
        fs.writeFileSync(INDEX, parseIndex.jsonToIndex(index));
      }

      // Show output message when finished
      if (indexExists) {
        console.log(`Reinitialised existing kanbn board in ${MAIN_FOLDER}`);
      } else {
        console.log(`Initialised empty kanbn board in ${MAIN_FOLDER}`);
      }
    },

    /**
     * Get the index from index.md as an object
     * @return {object} The index
     */
    getIndex() {
      if (exists(INDEX)) {
        return parseIndex.indexToJson(fs.readFileSync(INDEX, { encoding: 'utf-8' }));
      } else {
        throw new Error(`Couldn't access index file: ${INDEX}`);
      }
    },

    /**
     * Get a task as an object
     * @param {string} id The task id to get
     * @return {object} The task
     */
    getTask(id) {
      const TASK = path.join(TASK_FOLDER, id, '.md');
      if (exists(TASK)) {
        return parseTask.taskToJson(fs.readFileSync(TASK, { encoding: 'utf-8' }));
      } else {
        throw new Error(`Couldn't access task file: ${TASK}`);
      }
    },

    createTask(taskData) {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    updateTask(id, taskData) {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    deleteTask(id) {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    moveTask(id, column) {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    search(filters = []) {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    stats() {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    burndown(start, end) {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      //
    },

    /**
     * Nuke it from orbit, it's the only way to be sure
     */
    nuclear() {
      if (!this.initialised()) {
        throw new Error('Not initialised in this folder!');
      }
      fs.rmdirSync(MAIN_FOLDER, { recursive: true });
    }
  }
})();
