const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

/**
 * Move a task interactively
 * @param {string} columnName
 * @param {string[]} columnNames
 * @return {Promise<any>}
 */
async function interactive(columnName, columnNames) {
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
    utility.error(`Task "${taskId}" is already in column "${columnName}"`, true);
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
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the task that we're moving
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn move "task id"{b}', true);
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error, true);
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error, true);
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    utility.error('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}', true);
  }

  // Get column name if specified
  let currentColumnName = await kanbn.findTaskColumn(taskId);
  let columnName = currentColumnName;
  if (args.column) {
    columnName = utility.argToString(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`, true);
    }
  }

  // Move task interactively
  if (args.interactive) {
    interactive(columnName, columnNames)
    .then(answers => {
      moveTask(taskId, columnName, currentColumnName);
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise move task non-interactively
  } else {
    moveTask(taskId, columnName, currentColumnName);
  }
};
