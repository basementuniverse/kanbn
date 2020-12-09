const kanbn = require('../lib/main');
const Spinner = require('cli-spinner').Spinner;
const term = require('terminal-kit').terminal;

module.exports = (() => {
  const TASK_SEPARATOR = '\n\n';
  const FIELD_SEPARATOR = '\n';

  const defaultTaskOutputOptions = [
    'name'
  ];

  const taskCache = {};

  /**
   * Show only the selected fields for a task, as specified in the index options
   * @param {object} index
   * @param {object} taskData
   * @return {string} The selected task fields
   */
  function getTaskOutput(index, taskData) {
    return taskData.name;
  }

  return {

    /**
     * Show the kanbn board
     * @param {object} index The index object
     * @param {boolean} quiet True if only showing task ids
     */
    async show(index, quiet = false) {
      let tasks;
      if (!quiet) {

        // Show loading spinner while we load tasks
        const spinner = new Spinner('Loading kanbn board...');
        spinner.setSpinnerString(18);
        spinner.start();

        // Load all tracked tasks and get output from each one
        const trackedTaskPromises = [...await kanbn.findTrackedTasks()].map(async taskId => {
          if (!(taskId in taskCache)) {
            taskCache[taskId] = await kanbn.getTask(taskId);
          }
          return taskCache[taskId];
        });
        tasks = Object.fromEntries((await Promise.all(trackedTaskPromises)).map(task => [
          task.id,
          getTaskOutput(index, task)
        ]));
        spinner.stop(true);
      } else {

        // Only show task ids
        tasks = Object.fromEntries(Object.values(index.columns).flat().map(taskId => [taskId, taskId]));
      }

      // Display as a table
      term.table(
        [
          Object.keys(index.columns),
          Object.values(index.columns).map(
            columnTasks => columnTasks.map(taskId => tasks[taskId]).join(TASK_SEPARATOR)
          )
        ],
        {
          hasBorder: true,
          contentHasMarkup: true,
          borderChars: 'lightRounded',
          borderAttr: { color: 'grey' },
          textAttr: { bgColor: 'default' },
          width: term.width,
          fit: true
        }
      );
    }
  }
})();
