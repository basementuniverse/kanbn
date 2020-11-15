const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;
const fuzzy = require('fuzzy');

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Create a task interactively
 * @param {object} taskData
 * @param {string} columnName
 * @param {string[]} columnNames
 */
async function interactive(taskData, columnName, columnNames) {
  const trackedTasks = [...await kanbn.findTrackedTasks()];
  return await inquirer.prompt([
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
      type: 'confirm',
      name: 'setDescription',
      message: 'Add a description?'
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Task description:',
      default: taskData.description,
      when: answers => answers.setDescription
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
      message: 'Set a due date?',
      default: false
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
      default: false,
      prompts: [
        {
          type: 'input',
          name: 'subTaskTitle',
          message: 'Sub-task title:',
          validate: value => {
            if ((/.+/).test(value)) {
              return true;
            }
            return 'Sub-task title cannot be empty';
          }
        }
      ]
    },
    {
      type: 'recursive',
      name: 'tags',
      message: 'Add a tag?',
      default: false,
      prompts: [
        {
          type: 'input',
          name: 'tagName',
          message: 'Tag:',
          validate: value => {
            if ((/.+/).test(value)) {
              return true;
            }
            return 'Tag name cannot be empty';
          }
        }
      ]
    },
    {
      type: 'recursive',
      name: 'relations',
      message: 'Add a relation?',
      default: false,
      prompts: [
        {
          type: 'autocomplete',
          name: 'relatedTaskId',
          message: 'Task id:',
          source: (answers, input) => {
            input = input || '';
            const result = fuzzy.filter(input, trackedTasks);
            return new Promise(resolve => {
              resolve(result.map(result => result.string));
            });
          }
        },
        {
          type: 'input',
          name: 'relationType',
          message: 'Type:'
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
    utility.showError(error);
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
    utility.showError(error);
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
        utility.showError(error);
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
        utility.showError(error);
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
      metadata: {}
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
        if ('description' in answers) {
          taskData.description = answers.description;
        }
        if ('due' in answers) {
          taskData.metadata.due = answers.due.toISOString();
        }
        if ('subTasks' in answers) {
          taskData.subTasks = answers.subTasks.map(subTask => ({
            text: subTask.subTaskTitle,
            checked: false
          }));
        }
        if ('tags' in answers && answers.tags.length > 0) {
          taskData.metadata.tags = answers.tags.map(tag => tag.tagName);
        }
        if ('relations' in answers) {
          taskData.relations = answers.relations.map(relation => ({
            task: relation.relatedTaskId,
            type: relation.relationType
          }));
        }
        columnName = answers.column;
        createTask(taskData, columnName);
      })
      .catch(error => {
        utility.showError(error);
      });
    } else {
      createTask(taskData, columnName);
    }
  }
};
