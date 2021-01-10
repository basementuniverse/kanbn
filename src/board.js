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
      started: 'started' in task.metadata ? formatDate(task.metadata.started, dateFormat) : '',
      completed: 'completed' in task.metadata ? formatDate(task.metadata.completed, dateFormat) : '',
      due: 'due' in task.metadata ? formatDate(task.metadata.due, dateFormat) : '',
      tags: 'tags' in task.metadata ? task.metadata.tags : [],
      subTasks: task.subTasks,
      relations: task.relations,
      overdue: 'dueData' in task && 'overdue' in task.dueData ? task.dueData.overdue : null,
      dueDelta: 'dueData' in task && 'dueDelta' in task.dueData ? task.dueData.dueDelta : 0,
      dueMessage: 'dueData' in task && 'dueMessage' in task.dueData ? task.dueData.dueMessage : '',
      column: task.column,
      workload: task.workload,
      progress: task.progress
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
     * @param {object[]} tasks An array of task objects
     * @param {?string} [view=null] The view to show, or null to show the default view
     */
    async show(index, tasks, view = null) {
      const table = [];

      // Get view settings
      let viewSettings = {};
      if (view !== null) {

        // Make sure the view exists
        if (
          !('views' in index.options) ||
          (viewSettings = index.options.views.find(v => v.name === view)) === undefined
        ) {
          throw new Error(`No view found with name "${view}"`);
        }
      }

      // Make sure there is a list of columns in the view settings
      if (!('columns' in viewSettings)) {
        viewSettings.columns = Object.keys(index.columns)
          .filter(columnName => (
            !('hiddenColumns' in index.options) ||
            index.options.hiddenColumns.indexOf(columnName) === -1
          ))
          .map(columnName => ({
            name: columnName,
            filters: {
              column: columnName
            }
          }));
      }

      // Make sure there is a list of lanes in the view settings
      if (!('lanes' in viewSettings) || viewSettings.lanes.length === 0) {
        viewSettings.lanes = [{
          name: 'All tasks'
        }];
      }

      // If a root-level filter is defined, apply it to the tasks
      if ('filters' in viewSettings) {
        tasks = kanbn.filterAndSortTasks(index, tasks, viewSettings.filters, []);
      }

      // Add column headings
      table.push(viewSettings.columns.map(column => getColumnHeading(index, column.name)));

      // Add lanes and column contents
      for (let lane of viewSettings.lanes) {
        const columns = [];
        for (let column of viewSettings.columns) {
          const cellTasks = kanbn.filterAndSortTasks(
            index,
            tasks,
            {
              ...('filters' in column ? column.filters : {}),
              ...('filters' in lane ? lane.filters : {})
            },
            'sorters' in column ? column.sorters : []
          );
          columns.push(cellTasks.map(task => getTaskString(index, task)).join(TASK_SEPARATOR));
        }
        table.push([lane.name]);
        table.push(columns);
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
