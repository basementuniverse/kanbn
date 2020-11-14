const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));

/**
 * Create a task interactively
 * @param {object} taskData
 * @param {string} columnName
 * @param {string[]} columnNames
 */
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
      default: columnName,
      choices: columnNames
    },
    {
      type: 'confirm',
      name: 'setDue',
      message: 'Set a due date?'
    },
    {
      type: 'datepicker',
      name: 'due',
      message: 'Due date:',
      default: new Date(),
      format: ['Y', '/', 'MM', '/', 'DD'],
      when: answers => answers.setDue,
    },
    {
      type: 'recursive',
      name: 'subTasks',
      message: 'Add a sub-task?',
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

/**
 * Create a task
 * @param {object} taskData
 * @param {string} columnName
 */
function createTask(taskData, columnName) {
  kanbn
  .createTask(taskData, columnName)
  .then(taskId => {
    console.log(`Created task "${taskId}" in column "${columnName}"`);
  })
  .catch(error => {
    console.error(error.message);
  });
}

module.exports = async (args) => {
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    console.error(error.message);
    return;
  }
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
      try {
        untrackedTasks.push(...await kanbn.findUntrackedTasks());
      } catch (error) {
        console.error(error.message);
        return;
      }
    }
    const spinner = new Spinner('Adding untracked tasks...');
    spinner.setSpinnerString(18);
    spinner.start();
    for (let untrackedTask of untrackedTasks) {
      try {
        await kanbn.addUntrackedTaskToIndex(untrackedTask, columnName);
      } catch (error) {
        spinner.stop(true);
        console.error(error.message);
        return;
      }
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
        if (answers.due) {
          taskData.metadata.due = answers.due.toISOString();
        }
        taskData.subTasks = answers.subTasks.map(subTask => ({
          text: subTask.subTaskTitle,
          checked: false
        }));
        columnName = answers.column;
        createTask(taskData, columnName);
      })
      .catch(error => {
        console.error(error.message);
      });
    } else {
      createTask(taskData, columnName);
    }
  }
};
