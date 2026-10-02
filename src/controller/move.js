const workspace = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

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
function moveTask(taskId, columnName, position = null, relative = false, add = false) {
  kanbn
  .moveTask(taskId, columnName, position, relative, add)
  .then(taskId => {
    console.log(`Moved task "${taskId}" to column "${columnName}"`);
    utility.showActionWarnings(kanbn);
  })
  .catch(error => {
    utility.error(error);
  });
}

/**
 * Add a task to the board it's being moved on, because it isn't on that board yet
 * @param {string} taskId
 * @param {string} columnName
 * @param {string} boardSlug
 * @param {boolean} verbose
 */
async function addTaskToBoard(taskId, columnName, boardSlug, verbose) {
  try {
    await kanbn.addTaskToBoard(taskId, columnName);
    if (verbose) {
      console.log(utility.replaceTags(
        `{d}Task "${taskId}" wasn't on board "${boardSlug}" - it has been added{d}`
      ));
    }
    console.log(`Moved task "${taskId}" to column "${columnName}"`);
    utility.showActionWarnings(kanbn);
  } catch (error) {
    utility.error(error);
  }
}

/**
 * Move a simple task to another column on the board it's on
 * @param {object} boardKanbn The board-scoped Kanbn instance
 * @param {string} input
 * @param {?string} columnName The column to move to, or null to leave it where it is
 * @param {?number} position
 */
async function moveSimpleTask(boardKanbn, input, columnName, position) {
  try {
    const moved = await boardKanbn.moveSimpleTask(input, columnName, position);
    console.log(`Moved simple task "${moved.text}" to column "${moved.toColumn}"`);
  } catch (error) {
    utility.error(error);
  }
}

/**
 * Move a simple task onto another board
 * @param {object} sourceKanbn The board the simple task is on
 * @param {string} input
 * @param {string} targetSlug
 * @param {?string} columnName
 * @param {?number} position
 */
async function moveSimpleTaskToBoard(sourceKanbn, input, targetSlug, columnName, position) {
  try {
    const moved = await sourceKanbn.moveSimpleTaskToBoard(input, targetSlug, columnName, position);
    console.log(
      `Moved simple task "${moved.text}" to column "${moved.toColumn}" on board "${moved.toBoard}"`
    );
  } catch (error) {
    utility.error(error);
  }
}

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

  // Get the task that we're moving
  const taskId = await utility.resolveTaskArg(kanbn, args, 'move');
  if (taskId === null) {
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

  // Re-use sprint option for position
  let newPosition = args.position || args.p;
  if (newPosition) {
    newPosition = parseInt(utility.trimLeftEscapeCharacters(newPosition));
    if (isNaN(newPosition)) {
      utility.error('Position value must be numeric');
      return;
    }
  } else {
    newPosition = null;
  }

  // A task file always wins, so a simple task - a line in a column that isn't a task link - is only
  // looked for when nothing has this task id. Falling through leaves every existing error unchanged
  if (!(await kanbn.taskFileExists(taskId))) {
    const targetColumn = args.column ? utility.strArg(args.column) : null;
    const matches = await kanbn.findSimpleTasks(taskId);
    if (matches.length) {
      const simpleTask = await utility.resolveSimpleTask(kanbn, taskId, null, matches);
      if (simpleTask !== null) {
        await moveSimpleTask(
          kanbn,
          taskId,
          targetColumn === null ? simpleTask.column : targetColumn,
          newPosition
        );
      }
      return;
    }

    // A simple task lives in one board file rather than in a shared task file, so `-b` names the
    // board it is moving to rather than the board it is on
    if (args.board) {
      const sourceKanbn = await workspace.boardFromArgs({});
      if ((await sourceKanbn.findSimpleTasks(taskId)).length) {
        await moveSimpleTaskToBoard(
          sourceKanbn,
          taskId,
          await kanbn.resolveBoardSlug(),
          targetColumn,
          newPosition
        );
        return;
      }
    }
  }

  // Moving a task on a board it isn't on yet adds it there, so that pulling work onto a board is one
  // command rather than two. --no-add turns that back into an error. The main board is unaffected:
  // moving an untracked task there has always been an error and still is
  const boardSlug = await kanbn.resolveBoardSlug();
  const onThisBoard = boardSlug in await workspace.findTaskBoards(taskId);
  if (!onThisBoard && !(await kanbn.isMainBoard())) {
    if (!(await kanbn.taskFileExists(taskId))) {
      utility.error(`No task file found with id "${taskId}"`);
      return;
    }
    if (!args.add) {
      utility.error(
        `Task "${taskId}" is not on board "${boardSlug}"\n` +
        'Drop {b}--no-add{b} to add it to this board while moving it'
      );
      return;
    }
    let targetColumn = columnNames[0];
    if (args.column) {
      targetColumn = utility.strArg(args.column);
      if (columnNames.indexOf(targetColumn) === -1) {
        utility.error(`Column "${targetColumn}" doesn't exist`);
        return;
      }
    }
    await addTaskToBoard(taskId, targetColumn, boardSlug, kanbn.isVerbose(index));
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error);
    return;
  }

  // Get column name if specified
  const currentColumnName = await kanbn.findTaskColumn(taskId);
  let columnName = currentColumnName;
  if (args.column) {
    columnName = utility.strArg(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`);
      return;
    }
  }

  // Re-use sprint option for position
  const currentPosition = index.columns[currentColumnName].indexOf(taskId);

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
      utility.error(error);
    });

  // Otherwise move task non-interactively
  } else {
    moveTask(taskId, columnName, newPosition, args.relative, args.add);
  }
};
