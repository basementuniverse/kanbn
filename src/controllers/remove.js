const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

/**
 * Remove a task
 * @param {string} taskId
 * @param {boolean} removeFile
 */
function removeTask(taskId, removeFile) {
  const spinner = new Spinner('Deleting task...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .deleteTask(taskId, removeFile)
  .then(taskId => {
    spinner.stop(true);
    console.log(`Removed task "${taskId}"${removeFile ? ' from the index' : ' file and index entry'}`);
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the task that we're removing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn remove "task id"{b}', true);
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error, true);
  }

  // Get the index
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error, true);
  }

  // If the force flag is specified, remove the task without asking
  if (args.force) {
    removeTask(taskId, args.index);

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
        removeTask(taskId, args.index);
      }
    }).catch(error => {
      utility.error(error, true);
    })
  }
};
