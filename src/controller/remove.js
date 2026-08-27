const workspace = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

/**
 * Remove a task
 * @param {string} taskId
 * @param {boolean} removeFile True if the task file should be deleted as well as the index entry
 * @param {boolean} allBoards Remove the task from every board that references it
 * @param {string} boardSlug The board the task is being removed from
 * @param {boolean} secondaryBoard True if that board isn't the main board
 */
function removeTask(taskId, removeFile, allBoards, boardSlug, secondaryBoard) {
  kanbn
  .deleteTask(taskId, removeFile, allBoards)
  .then(taskId => {
    console.log(
      `Removed task "${taskId}"${removeFile ? ' file and index entry' : ' from the index'}` +
      (secondaryBoard && !allBoards ? ` on board "${boardSlug}"` : '')
    );
  })
  .catch(error => {

    // Only a task that's on other boards can be removed from all of them, or from this one alone
    utility.error(utility.replaceTags(
      /other board/.test(error.message)
        ? `${error.message}\nUse {b}--all-boards{b} to remove it from all of them, or {b}--index{b} ` +
          'to remove it from this board only'
        : error.message
    ));
  });
}

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

  // Get the task that we're removing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn remove "task id"{b}');
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error);
    return;
  }

  // Get the index
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error);
    return;
  }

  // A task file is shared between boards, so deleting it while another board still references it
  // needs --all-boards. Removing the task from this board's index alone is always safe
  const allBoards = !!args['all-boards'];
  const boardSlug = await kanbn.resolveBoardSlug();
  const secondaryBoard = !(await kanbn.isMainBoard());

  // If the force flag is specified, remove the task without asking
  if (args.force) {
    removeTask(taskId, !args.index, allBoards, boardSlug, secondaryBoard);

  // Otherwise, prompt for confirmation first
  } else {
    inquirer.prompt([
      {
        type: 'confirm',
        message: 'Are you sure you want to remove this task?',
        name: 'sure',
        default: false
      }
    ]).then(async answers => {
      if (answers.sure) {
        removeTask(taskId, !args.index, allBoards, boardSlug, secondaryBoard);
      }
    }).catch(error => {
      utility.error(error);
    })
  }
};
