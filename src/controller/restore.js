const workspace = require('../main');
const utility = require('../utility');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

/**
 * Restore a task from the archive
 * @param {string} taskId
 * @param {string|null} columnName
 */
function restoreTask(taskId, columnName, singleBoard) {
  kanbn
  .restoreTask(taskId, columnName, singleBoard)
  .then(taskId => {
    console.log(`Restored task "${taskId}" from the archive`);
    utility.showActionWarnings(kanbn);

    // A task is restored to every board it was on when it was archived. A board that has since been
    // deleted is skipped rather than failing the restore, but the user should hear about it
    const missing = kanbn.lastRestoreWarnings || [];
    if (missing.length) {
      console.log(
        `Couldn't restore "${taskId}" to ${missing.length === 1 ? 'board' : 'boards'} ` +
        `${missing.map(slug => `"${slug}"`).join(', ')} - no longer ${missing.length === 1 ? 'exists' : 'exist'}`
      );
    }
  })
  .catch(error => {
    utility.error(error);
  });
}

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

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

  // Restore the task. Without --board it goes back to every board it was on when it was archived;
  // with --board it goes only to that one
  restoreTask(taskId, columnName, !!args.board);
};
