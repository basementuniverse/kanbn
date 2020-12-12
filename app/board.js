const term = require('terminal-kit').terminal;
const formatDate = require('dateformat');

module.exports = (() => {
  const TASK_SEPARATOR = '\n\n';

  const defaultDateFormat = 'd mmm yy, H:MM';
  const defaultTaskTemplate = (
    "^+^_${selected ? '^!' : ''}${overdue ? '^R' : ''}${name}^:" +
    "${created ? '\\n' : ''}^-^/${created}" +
    "${tags.join(',').match(/Tiny|Small|Medium|Large|Huge/) ? '\\n' : ''}" +
    "${tags.indexOf('Tiny') !== -1 ? '^#^c^ktiny^: ' : ''}" +
    "${tags.indexOf('Small') !== -1 ? '^w^#^gsmall^: ' : ''}" +
    "${tags.indexOf('Medium') !== -1 ? '^w^#^bmedium^: ' : ''}" +
    "${tags.indexOf('Large') !== -1 ? '^k^#^ylarge^: ' : ''}" +
    "${tags.indexOf('Huge') !== -1 ? '^w^#^rhuge^: ' : ''}"
  );

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
     * @param {?object[]} [tasks=null] An array of task objects, if this is null then only show task ids
     * @param {string} [selectedTask=null] The selected task, or null if no task is selected
     */
    async show(index, tasks = null, selectedTask = null) {
      if (tasks !== null) {

        // Transform each task using a template string
        tasks = Object.fromEntries(tasks.map(task => [
          task.id,
          getTaskString(index, task, task.id === selectedTask)
        ]));
      } else {

        // Only show task ids
        tasks = Object.fromEntries(Object.values(index.columns).flat().map(taskId => [taskId, taskId]));
      }

      // Display as a table
      term.table(
        [
          Object.keys(index.columns).map(columnName => `^+${columnName}^:`),
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
