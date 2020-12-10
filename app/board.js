const kanbn = require('../lib/main');
const Spinner = require('cli-spinner').Spinner;
const term = require('terminal-kit').terminal;
const formatDate = require('dateformat');

module.exports = (() => {
  const TASK_SEPARATOR = '\n\n';

  const defaultDateFormat = 'd mmm yy, H:MM';
  const defaultTaskTemplate = "^+${selected ? '^_' : ''}${overdue ? '^R' : ''}${name}\n^-${created}";

  /**
   * Show only the selected fields for a task, as specified in the index options
   * @param {object} index
   * @param {object} task
   * @return {string} The selected task fields
   */
  function getTaskString(index, task, selected = false) {
    const taskTemplate = 'taskTemplate' in index.options ? index.options.taskTemplate : defaultTaskTemplate;
    const dateFormat = 'dateFormat' in index.options ? index.options.dateFormat : defaultDateFormat;
    const taskData = {
      name: task.name,
      description: task.name,
      created: 'created' in task.metadata ? formatDate(task.metadata.created, dateFormat) : '',
      updated: 'updated' in task.metadata ? formatDate(task.metadata.updated, dateFormat) : '',
      started: 'started' in task.metadata ? formatDate(task.metadata.started, dateFormat) : '',
      completed: 'completed' in task.metadata ? formatDate(task.metadata.completed, dateFormat) : '',
      due: 'due' in task.metadata ? formatDate(task.metadata.due, dateFormat) : '',
      tags: 'tags' in task.metadata ? task.metadata.tags : [],
      subTasks: task.subTasks,
      relations: task.relations,
      overdue: 'overdue' in task ? task.overdue : null,
      dueDelta: 'dueDelta' in task ? task.dueDelta : 0,
      dueMessage: 'dueMessage' in task ? task.dueMessage : '',
      column: task.column,
      workload: task.workload,
      selected: selected
    };
    return new Function(...Object.keys(taskData), 'return `' + taskTemplate + '`;')(...Object.values(taskData));
  }

  return {

    /**
     * Show the kanbn board
     * @param {object} index The index object
     * @param {boolean} [quiet=false] True if only showing task ids
     * @param {string} [selectedTask=null] The selected task, or null if no task is selected
     */
    async show(index, quiet = false, selectedTask = null) {
      let tasks;
      if (!quiet) {

        // Show loading spinner while we load tasks
        const spinner = new Spinner('Loading kanbn board...');
        spinner.setSpinnerString(18);
        spinner.start();

        // Load all tracked tasks
        const trackedTaskPromises = [...await kanbn.findTrackedTasks()].map(
          async taskId => kanbn.hydrateTask(index, await kanbn.getTask(taskId))
        );
        tasks = Object.fromEntries((await Promise.all(trackedTaskPromises)).map(task => [
          task.id,
          getTaskString(index, task, task.id === selectedTask)
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
