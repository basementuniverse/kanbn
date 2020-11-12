const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;
const path = require('path');

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));

async function interactive(taskData, columnName, columnNames) {
  return await inquirer
  .prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Task title:',
      default: taskData.title || '',
      validate: async function (value) {
        if ((/.+/).test(value)) {
          return true;
        }
        return 'Task title cannot be empty';
      }
    },
    {
      type: 'list',
      name: 'column',
      message: 'Column:',
      choices: columnNames,
      default: columnName
    },
    {
      type: 'datepicker',
      name: 'due',
      message: 'Due date:',
      default: new Date(),
      format: ['Y', '/', 'MM', '/', 'DD']
    },
    {
      type: 'recursive',
      message: 'Add a sub-task?',
      name: 'subTasks',
      prompts: [
        {
          type: 'input',
          name: 'subTaskTitle',
          message: 'Sub-task title:',
          validate: function (value) {
            if ((/.+/).test(value)) {
              return true;
            }
            return 'Sub-task title cannot be empty';
          }
        }
      ]
    }
  ]);
}

function createTask(taskData, columnName) {
  kanbn
  .createTask(taskData, columnName)
  .then(taskId => {
    console.log(`Created task "${taskId}" in column "${columnName}"`);
  })
  .catch(error => {
    console.error(error);
  });
}

module.exports = async (args) => {
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get the index and make sure it has some columns
  const index = await kanbn.getIndex();
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    console.error(utility.replaceTags('No columns defined in the index\nTry editing {b}index.md{b}'));
    return;
  }

  // Get column name if specified, otherwise default to the first available column
  let columnName = columnNames[0];
  if (args.column) {
    if (columnNames.indexOf(args.column) === -1) {
      console.log(`Column "${args.column}" doesn't exist`);
      return;
    }
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
    console.log(
      `Added ${untrackedTasks.length} task${untrackedTasks.length !== 1 ? 's' : ''} to column "${columnName}"`
    );

  // Otherwise, create a task from arguments or interactively
  } else {
    const taskData = {
      metadata: {},
      subTasks: []
    };

    // Get task settings from arguments
    if (args.title) {
      taskData.title = args.title;
    }

    // Create task interactively
    if (args.interactive) {
      interactive(taskData, columnName, columnNames)
      .then(answers => {
        taskData.title = answers.title;
        taskData.metadata.due = answers.due.toISOString();
        taskData.subTasks = answers.subTasks.map(subTask => ({
          text: subTask.subTaskTitle,
          checked: false
        }));
        columnName = answers.column;
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
