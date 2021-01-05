const kanbn = require('./main');
const term = require('terminal-kit').terminal;
const formatDate = require('dateformat');

module.exports = (() => {
  const TASK_SEPARATOR = '\n\n';

  /**
   * Show only the selected fields for a task, as specified in the index options
   * @param {object} index
   * @param {object} task
   * @return {string} The selected task fields
   */
  function getTaskString(index, task) {
    const taskTemplate = kanbn.getTaskTemplate(index);
    const dateFormat = kanbn.getDateFormat(index);
    const taskData = {
      name: task.name,
      description: task.name,
      created: 'created' in task.metadata ? formatDate(task.metadata.created, dateFormat) : '',
      updated: 'updated' in task.metadata ? formatDate(task.metadata.updated, dateFormat) : '',
      completed: 'completed' in task.metadata ? formatDate(task.metadata.completed, dateFormat) : '',
      due: 'due' in task.metadata ? formatDate(task.metadata.due, dateFormat) : '',
      tags: 'tags' in task.metadata ? task.metadata.tags : [],
      subTasks: task.subTasks,
      relations: task.relations,
      overdue: 'dueData' in task && 'overdue' in task.dueData ? task.dueData.overdue : null,
      dueDelta: 'dueData' in task && 'dueDelta' in task.dueData ? task.dueData.dueDelta : 0,
      dueMessage: 'dueData' in task && 'dueMessage' in task.dueData ? task.dueData.dueMessage : '',
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
    return heading + `^+${columnName}^:`;
  }

  return {

    /**
     * Show the kanbn board
     * @param {object} index The index object
     * @param {?object[]} [tasks=null] An array of task objects, if this is null then only show task ids
     * @param {?string} [view=null] The view to show, or null to show the default view
     */
    async show(index, tasks = null, view = null) {

      // If we have an array of pre-loaded tasks, transform each task using a template string
      if (tasks !== null) {
        tasks = Object.fromEntries(tasks.map(task => [
          task.id,
          getTaskString(index, task)
        ]));

      // Otherwise we're only showing task ids, so get all task ids from the index
      } else {
        tasks = Object.fromEntries(Object.values(index.columns).flat().map(taskId => [taskId, taskId]));

        // Views are unavailable when only showing task ids
        view = null;
      }

      // Prepare table headings and content
      const table = [];

      // Check if we're showing a filtered view
      if (view !== null) {

        // Make sure the view exists
        let viewSettings;
        if (
          'views' in index.options &&
          (viewSettings = index.options.views.find(v => v.name === view)) !== undefined
        ) {
          const headings = [];
          headings.push(...viewSettings.columns.map(column => getColumnHeading(column.name)));

          const cells = [];
          for (let lane of viewSettings.lanes) {
            const columns = [];
            for (let column of viewSettings.columns) {
              const cellTasks = kanbn.filterAndSortTasks(
                index,
                tasks,
                { ...column.filters, ...lane.filters },
                column.sorters
              );
              columns.push(cellTasks.map(task => tasks[task.id]).join(TASK_SEPARATOR));
            }
            cells.push([lane.name]);
            cells.push(columns);
          }
          table.push(headings, cells);
        } else {
          throw new Error(`No view found with name "${view}"`);
        }

      // Otherwise show the basic columns and all tasks defined in the index
      } else {
        const headings = [];
        const columns = [];
        for (let [columnName, columnTasks] of Object.entries(index.columns)) {
          if (
            'hiddenColumns' in index.options &&
            index.options.hiddenColumns.indexOf(columnName) !== -1
          ) {
            continue;
          }
          headings.push(getColumnHeading(index, columnName));
          columns.push(columnTasks.map(taskId => tasks[taskId]).join(TASK_SEPARATOR));
        }
        table.push(headings, columns);
      }

      // Display as a table
      term.table(
        table,
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
