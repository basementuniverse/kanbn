const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

inquirer.registerPrompt('selectLine', require('inquirer-select-line'));

/**
 * Move a task interactively
 * @param {object} columns
 * @param {string} columnName
 * @param {string[]} columnNames
 * @param {string[]} sortedColumnNames
 * @param {string} taskId
 * @param {number} position
 * @return {Promise<any>}
 */
async function interactive(columns, columnName, columnNames, sortedColumnNames, taskId, position) {
  return await inquirer.prompt([
    {
      type: 'list',
      name: 'column',
      message: 'Column:',
      default: columnName,
      choices: columnNames
    },
    {
      type: 'selectLine',
      name: 'position',
      message: 'Move task:',
      default: answers => Math.max(Math.min(position, columns[answers.column].length), 0),
      choices: answers => columns[answers.column].filter(t => t !== taskId),
      placeholder: taskId,
      when: answers => sortedColumnNames.indexOf(answers.column) === -1
    }
  ]);
}

/**
 * Move a task
 * @param {string} taskId
 * @param {string} columnName
 * @param {?number} [position=null]
 * @param {boolean} [relative=false]
 */
function moveTask(taskId, columnName, position = null, relative = false) {
  kanbn
  .moveTask(taskId, columnName, position, relative)
  .then(taskId => {
    console.log(`Moved task "${taskId}" to column "${columnName}"`);
  })
  .catch(error => {
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
  const currentColumnName = await kanbn.findTaskColumn(taskId);
  let columnName = currentColumnName;
  if (args.column) {
    columnName = utility.strArg(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`, true);
    }
  }

  // Re-use sprint option for position
  const currentPosition = index.columns[currentColumnName].indexOf(taskId);
  let newPosition = args.position || args.p;
  if (newPosition) {
    newPosition = parseInt(utility.trimLeftEscapeCharacters(newPosition));
    if (isNaN(newPosition)) {
      utility.error('Position value must be numeric', true);
    }
  } else {
    newPosition = null;
  }

  // Get a list of sorted columns
  const sortedColumnNames = 'columnSorting' in index.options ? Object.keys(index.options.columnSorting) : [];

  // Move task interactively
  if (args.interactive) {
    interactive(
      index.columns,
      columnName,
      columnNames,
      sortedColumnNames,
      taskId,
      newPosition === null
        ? currentPosition
        : (args.relative ? (currentPosition + newPosition) : newPosition)
    )
    .then(answers => {
      moveTask(taskId, answers.column, answers.position);
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise move task non-interactively
  } else {
    moveTask(taskId, columnName, newPosition, args.relative);
  }
};
