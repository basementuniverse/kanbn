const kanbn = require('../main');
const utility = require('../utility');

/**
 * Restore a task from the archive
 * @param {string} taskId
 * @param {string|null} columnName
 */
function restoreTask(taskId, columnName) {
  kanbn
  .restoreTask(taskId, columnName)
  .then(taskId => {
    console.log(`Restored task "${taskId}" from the archive`);
  })
  .catch(error => {
    utility.error(error);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }

  // Get the task that we're archiving
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn restore "task id"{b}');
    return;
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error);
    return;
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    utility.error('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}');
    return;
  }

  // Get column name if specified
  let columnName = null;
  if (args.column) {
    columnName = utility.strArg(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`);
      return;
    }
  }

  // Archive task
  restoreTask(taskId, columnName);
};
