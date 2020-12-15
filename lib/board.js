const term = require('terminal-kit').terminal;
const formatDate = require('dateformat');

module.exports = (() => {
  const TASK_SEPARATOR = '\n\n';

  const defaultDateFormat = 'd mmm yy, H:MM';
  const defaultTaskTemplate = "^+^_${overdue ? '^R' : ''}${name}^: ${created ? ('\\n^-^/' + created) : ''}";

  /**
   * Show only the selected fields for a task, as specified in the index options
   * @param {object} index
   * @param {object} task
   * @return {string} The selected task fields
   */
  function getTaskString(index, task) {
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
      workload: task.workload
    };
    return new Function(...Object.keys(taskData), 'return `' + taskTemplate + '`;')(...Object.values(taskData));
  }

  /**
   * Get a column heading with icons
   * @param {object} index
   * @param {string} columnName
   * @return {string} The column heading
   */
  function getColumnHeading(index, columnName) {
    let heading = '';
    if (
      'completedColumns' in index.options &&
      index.options.completedColumns.indexOf(columnName) !== -1
    ) {
      heading += '^g\u2713^: ';
    }
    if (
      'startedColumns' in index.options &&
      index.options.startedColumns.indexOf(columnName) !== -1
    ) {
      heading += '^c\u00bb^: ';
    }
    return heading + `^+${columnName}^:`;
  }

  return {

    /**
     * Show the kanbn board
     * @param {object} index The index object
     * @param {?object[]} [tasks=null] An array of task objects, if this is null then only show task ids
     */
    async show(index, tasks = null) {
      if (tasks !== null) {

        // Transform each task using a template string
        tasks = Object.fromEntries(tasks.map(task => [
          task.id,
          getTaskString(index, task)
        ]));
      } else {

        // Only show task ids
        tasks = Object.fromEntries(Object.values(index.columns).flat().map(taskId => [taskId, taskId]));
      }

      // Prepare table headings and content
      const headings = [];
      const cells = [];
      for (let [columnName, columnTasks] of Object.entries(index.columns)) {
        if (
          'hiddenColumns' in index.options &&
          index.options.hiddenColumns.indexOf(columnName) !== -1
        ) {
          continue;
        }
        headings.push(getColumnHeading(index, columnName));
        cells.push(columnTasks.map(taskId => tasks[taskId]).join(TASK_SEPARATOR));
      }

      // Display as a table
      term.table(
        [
          headings,
          cells
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
