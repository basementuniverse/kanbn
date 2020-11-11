const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;
const path = require('path');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

async function interactive(taskData, columnName) {
  return await inquirer
  .prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Task title:',
      default: taskData.title || '',
      validate: async function (value) {
        const exists = await kanbn.taskTitleExists(value);
        if (!exists) {
          return true;
        }
        return 'Task title exists already!';
      }
    }
  ]);
}

function createTask(taskData, columnName) {
  kanbn
  .createTask(taskData, columnName)
  .then(taskId => {
    console.log(`Created task ${taskData.title} (id: ${taskId}) in column ${columnName}`);
  })
  .catch(error => {
    console.log(error);
  });
}

module.exports = async (args) => {
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder!\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get the index and make sure it has some columns
  const index = await kanbn.getIndex();
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    console.error(utility.replaceTags('No columns defined in the index!\nTry editing {b}index.md{b}'));
    return;
  }

  // Get column name if specified, otherwise default to the first available column
  const columnName = columnNames[0];
  if (args.column) {
    columnName = args.column;
  }

  // Add untracked file(s)
  if (args.untracked) {
    const untrackedTasks = [];
    if (Array.isArray(args.untracked)) {
      untrackedTasks.push(...args.untracked);
    } else if (typeof args.untracked === 'string') {
      untrackedTasks.push(args.untracked);
    } else if (args.untracked === true) {
      untrackedTasks.push(...await kanbn.findUntrackedTasks());
    }
    const spinner = new Spinner('Adding untracked tasks...');
    spinner.setSpinnerString(18);
    spinner.start();
    for (let untrackedTask of untrackedTasks) {
      await kanbn.addUntrackedTask(untrackedTask);
    }
    spinner.stop(true);
    console.log(`Added ${untrackedTasks.length} tasks to column ${columnName}`);

  // Otherwise, create a task from arguments or interactively
  } else {
    const taskData = {};

    // Get task settings from arguments
    if (args.title) {
      taskData.title = args.title;
    }

    // Create task interactively
    if (args.interactive) {
      interactive(taskData, columnName)
      .then(answers => {
        createTask(taskData, columnName);
      })
      .catch(error => {
        console.log(error);
      });
    } else {
      createTask(taskData, columnName);
    }
  }
};
