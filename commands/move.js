const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

/**
 * Move a task interactively
 * @param {object} taskData
 * @param {string} columnName
 * @param {string[]} columnNames
 */
async function interactive(taskData, columnName, columnNames) {
  return await inquirer.prompt([
    {
      type: 'list',
      name: 'column',
      message: 'Column:',
      default: columnName,
      choices: columnNames
    }
  ]);
}

/**
 * Move a task
 * @param {string} taskId
 * @param {string} columnName
 * @param {string} currentColumnName
 */
function moveTask(taskId, columnName, currentColumnName) {

  // Check if the target column is the same as the current column
  if (columnName === currentColumnName) {
    console.log(`Task "${taskId}" is already in column "${columnName}"`);
    return;
  }

  // Target column is different to current column, so move the task
  const spinner = new Spinner('Moving task...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .moveTask(taskId, columnName)
  .then(taskId => {
    spinner.stop(true);
    console.log(`Moved task "${taskId}" to column "${columnName}"`);
  })
  .catch(error => {
    spinner.stop(true);
    utility.showError(error);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get the task that we're moving
  const taskId = args._[1];
  if (!taskId) {
    console.error(utility.replaceTags('No task id specified. Try running {b}kanbn move "task id"{b}'));
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.showError(error);
    return;
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.showError(error);
    return;
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    console.error(utility.replaceTags('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}'));
    return;
  }

  // Get column name if specified
  let currentColumnName = await kanbn.findTaskColumn(taskId);
  let columnName = currentColumnName;
  if (args.column) {
    if (columnNames.indexOf(args.column) === -1) {
      console.log(`Column "${args.column}" doesn't exist`);
      return;
    }
    columnName = args.column;
  }

  // Move task interactively
  if (args.interactive) {
    interactive(taskData, columnName, columnNames)
    .then(answers => {
      moveTask(taskId, columnName, currentColumnName);
    })
    .catch(error => {
      utility.showError(error);
    });

  // Otherwise move task non-interactively
  } else {
    moveTask(taskId, columnName, currentColumnName);
  }
};
