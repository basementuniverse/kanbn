const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const fuzzy = require('fuzzy');

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Update a task interactively
 * @param {object} taskData
 * @param {string} columnName
 * @param {string[]} columnNames
 */
async function interactive(taskData, columnName, columnNames) {
  // TODO interactive task update
}

/**
 * Update a task
 * @param {string} taskId
 * @param {object} taskData
 * @param {?string} columnName
 */
function updateTask(taskId, taskData, columnName) {
  kanbn
  .updateTask(taskId, taskData, columnName)
  .then(taskId => {
    console.log(`Updated task "${taskId}"`);
  })
  .catch(error => {
    utility.showError(error);
  });
}

/**
 * Find a task in the index and returns the column that it's in
 * @param {string} taskId The task id to search for
 * @param {object} index The index data
 * @return {?string} The column name for the specified task, or null if it wasn't found
 */
function findTaskColumn(taskId, index) {
  for (let columnName in index.columns) {
    if (index.columns[columnName].indexOf(taskId) !== -1) {
      return columnName;
    }
  }
  return null;
}

module.exports = async (args) => {
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  const taskId = args._[1];
  if (!taskId) {
    console.error(utility.replaceTags('No task id specified. Try running {b}kanbn edit "task id"{b}'));
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
    console.error(utility.replaceTags('No columns defined in the index\nTry editing {b}index.md{b}'));
    return;
  }

  // Get the current task data
  let taskData;
  try {
    taskData = await kanbn.getTask(taskId);
  } catch (error) {
    utility.showError(error);
  }

  // Get column name if specified
  let columnName = null;
  const currentColumn = findTaskColumn(taskId, index);
  if (args.column) {
    if (columnNames.indexOf(args.column) === -1) {
      console.log(`Column "${args.column}" doesn't exist`);
      return;
    }
    columnName = args.column !== currentColumn ? args.column : null;
  }

  // Get task title from arguments
  if (args.title) {
    taskData.title = args.title;
  }
  if (args.description) {
    taskData.description = args.description;
  }

  // Update task interactively
  if (args.interactive) {
    interactive(taskData, columnName, columnNames)
    .then(answers => {
      taskData.title = answers.title;
      if ('description' in answers) {
        taskData.description = answers.description;
      }
      if ('due' in answers) {
        taskData.metadata.due = answers.due.toISOString();
      }
      // TODO collate interactive edit answers
      // if ('subTasks' in answers) {
      //   taskData.subTasks = answers.subTasks.map(subTask => ({
      //     text: subTask.subTaskTitle,
      //     checked: false
      //   }));
      // }
      // if ('tags' in answers && answers.tags.length > 0) {
      //   taskData.metadata.tags = answers.tags.map(tag => tag.tagName);
      // }
      // if ('relations' in answers) {
      //   taskData.relations = answers.relations.map(relation => ({
      //     task: relation.relatedTaskId,
      //     type: relation.relationType
      //   }));
      // }
      columnName = answers.column !== currentColumn ? answers.column : null;
      updateTask(taskData, columnName);
    })
    .catch(error => {
      utility.showError(error);
    });
  } else {
    updateTask(taskData, columnName);
  }
};
