const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');
const fuzzy = require('fuzzy');
const chrono = require('chrono-node');
const getGitUsername = require('git-user-name');

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Create a task interactively
 * @param {object} taskData
 * @param {string[]} taskIds
 * @param {string} columnName
 * @param {string[]} columnNames
 * @return {Promise<any>}
 */
async function interactiveCreateTask(taskData, taskIds, columnName, columnNames) {
  const dueDateExists = (
    'metadata' in taskData &&
    'due' in taskData.metadata &&
    taskData.metadata.due != null
  );
  const assignedExists = (
    'metadata' in taskData &&
    'assigned' in taskData.metadata &&
    taskData.metadata.assigned != null
  );
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Task name:',
      default: taskData.name || '',
      validate: async value => {
        if (!value) {
          return 'Task name cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'setDescription',
      message: 'Add a description?',
      default: false
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
      default: false,
      when: answers => !dueDateExists
    },
    {
      type: 'datepicker',
      name: 'due',
      message: 'Due date:',
      default: dueDateExists ? taskData.metadata.due : new Date(),
      format: ['Y', '/', 'MM', '/', 'DD'],
      when: answers => answers.setDue,
    },
    {
      type: 'confirm',
      name: 'setAssigned',
      message: 'Assign this task?',
      default: false,
      when: answers => !assignedExists
    },
    {
      type: 'input',
      name: 'assigned',
      message: 'Assigned to:',
      default: assignedExists ? taskData.metadata.assigned : getGitUsername(),
      when: answers => answers.setAssigned || assignedExists
    },
    {
      type: 'recursive',
      name: 'subTasks',
      initialMessage: 'Add a sub-task?',
      message: 'Add another sub-task?',
      default: false,
      prompts: [
        {
          type: 'input',
          name: 'text',
          message: 'Sub-task text:',
          validate: value => {
            if (!value) {
              return 'Sub-task text cannot be empty';
            }
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'completed',
          message: 'Sub-task completed?',
          default: false
        }
      ]
    },
    {
      type: 'recursive',
      name: 'tags',
      initialMessage: 'Add a tag?',
      message: 'Add another tag?',
      default: false,
      prompts: [
        {
          type: 'input',
          name: 'name',
          message: 'Tag name:',
          validate: value => {
            if (!value) {
              return 'Tag name cannot be empty';
            }
            return true;
          }
        }
      ]
    },
    {
      type: 'recursive',
      name: 'relations',
      initialMessage: 'Add a relation?',
      message: 'Add another relation?',
      default: false,
      when: answers => taskIds.length > 0,
      prompts: [
        {
          type: 'autocomplete',
          name: 'task',
          message: 'Related task id:',
          source: (answers, input) => {
            input = input || '';
            const result = fuzzy.filter(input, taskIds);
            return new Promise(resolve => {
              resolve(result.map(result => result.string));
            });
          }
        },
        {
          type: 'input',
          name: 'type',
          message: 'Relation type:'
        }
      ]
    }
  ]);
}

/**
 * Add untracked tasks interactively
 * @param {string[]} untrackedTasks
 * @param {string} columnName
 * @param {string[]} columnNames
 */
async function interactiveAddUntrackedTasks(untrackedTasks, columnName, columnNames) {
  return await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'untrackedTasks',
      message: 'Choose which tasks to add:',
      choices: untrackedTasks
    },
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
    utility.error(error);
  });
}

/**
 * Add untracked tasks to the index
 * @param {string[]} untrackedTasks
 * @param {string} columnName
 */
async function addUntrackedTasks(untrackedTasks, columnName) {
  for (let untrackedTask of untrackedTasks) {
    try {
      await kanbn.addUntrackedTaskToIndex(untrackedTask, columnName);
    } catch (error) {
      utility.error(error);
      return;
    }
  }
  console.log(
    `Added ${untrackedTasks.length} task${untrackedTasks.length !== 1 ? 's' : ''} to column "${columnName}"`
  );
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
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

  // Get column name if specified, otherwise default to the first available column
  let columnName = columnNames[0];
  if (args.column) {
    columnName = utility.strArg(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`);
      return;
    }
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
        utility.error(error);
        return;
      }
    }

    // Make sure there are some untracked tasks to add
    if (untrackedTasks.length === 0) {
      utility.error('No untracked tasks to add');
      return;
    }

    // Add untracked files interactively
    if (args.interactive) {
      interactiveAddUntrackedTasks(untrackedTasks, columnName, columnNames)
      .then(async answers => {
        await addUntrackedTasks(answers.untrackedTasks, answers.column);
      })
      .catch(error => {
        utility.error(error);
      });
      return;
    } else {
      await addUntrackedTasks(untrackedTasks, columnName);
      return;
    }
  }

  // Otherwise, create a task from arguments or interactively
  const taskData = {
    metadata: {}
  };

  // Get a list of existing task ids
  const taskIds = [...await kanbn.findTrackedTasks()];

  // Get task settings from arguments
  // Name
  if (args.name) {
    taskData.name = utility.strArg(args.name);
  }

  // Description
  if (args.description) {
    taskData.description = utility.strArg(args.description);
  }

  // Due date
  if (args.due) {
    taskData.metadata.due = chrono.parseDate(utility.strArg(args.due));
    if (taskData.metadata.due === null) {
      utility.error('Unable to parse due date');
      return;
    }
  }

  // Progress
  if (args.progress) {
    const progressValue = parseFloat(utility.strArg(args.progress));
    if (isNaN(progressValue)) {
      utility.error('Progress value is not a number');
      return;
    }
    taskData.metadata.progress = progressValue;
  }

  // Assigned
  if (args.assigned) {
    const gitUsername = getGitUsername();
    if (args.assigned === true) {
      if (gitUsername) {
        taskData.metadata.assigned = gitUsername;
      }
    } else {
      taskData.metadata.assigned = utility.strArg(args.assigned);
    }
  }

  // Sub-tasks
  if (args['sub-task']) {
    const subTasks = utility.arrayArg(args['sub-task']);
    taskData.subTasks = subTasks.map(subTask => {
      const match = subTask.match(/^\[([x ])\] (.*)/);
      if (match !== null) {
        return {
          completed: match[1] === 'x',
          text: match[2]
        };
      }
      return {
        completed: false,
        text: subTask
      };
    });
  }

  // Tags
  if (args.tag) {
    taskData.metadata.tags = utility.arrayArg(args.tag);
  }

  // Relations
  if (args.relation) {
    const relations = utility.arrayArg(args.relation).map(relation => {
      const parts = relation.split(':');
      return parts.length === 1
        ? {
          type: '',
          task: parts[0].trim()
        }
        : {
          type: parts[0].trim(),
          task: parts[1].trim()
        };
    });

    // Make sure each relation is an existing task
    for (let relation of relations) {
      if (taskIds.indexOf(relation.task) === -1) {
        utility.error(`Related task ${relation.task} doesn't exist`);
        return;
      }
    }
    taskData.relations = relations;
  }

  // Check metadata field types
  if ('customFields' in index.options) {
    for (let arg of Object.keys(args)) {
      const customField = index.options.customFields.find(p => p.name === arg);
      if (customField !== undefined) {

        // Check value type
        switch (customField.type) {
          case 'boolean':
            if (typeof args[arg] === 'boolean') {
              taskData.metadata[arg] = args[arg];
            } else {
              utility.error(`Custom field "${arg}" value is not a boolean`);
              return;
            }
            break;
          case 'number':
            const numberValue = parseFloat(args[arg]);
            if (!isNaN(numberValue)) {
              taskData.metadata[arg] = numberValue;
            } else {
              utility.error(`Custom field "${arg}" value is not a number`);
              return;
            }
            break;
          case 'string':
            if (typeof args[arg] === 'string') {
              taskData.metadata[arg] = args[arg];
            } else {
              utility.error(`Custom field "${arg}" value is not a string`);
              return;
            }
            break;
          case 'date':
            const dateValue = chrono.parseDate(args[arg]);
            if (dateValue instanceof Date) {
              taskData.metadata[arg] = dateValue;
            } else {
              utility.error(`Unable to parse date for custom field "${arg}"`);
              return;
            }
            break;
          default: break;
        }
      }
    }
  }

  // Create task interactively
  if (args.interactive) {
    interactiveCreateTask(taskData, taskIds, columnName, columnNames)
    .then(answers => {
      taskData.name = answers.name;
      if ('description' in answers) {
        taskData.description = answers.description;
      }
      if ('due' in answers) {
        taskData.metadata.due = answers.due.toISOString();
      }
      if ('assigned' in answers) {
        taskData.metadata.assigned = answers.assigned;
      }
      if ('subTasks' in answers) {
        taskData.subTasks = answers.subTasks.map(subTask => ({
          text: subTask.text,
          completed: subTask.completed
        }));
      }
      if ('tags' in answers && answers.tags.length > 0) {
        taskData.metadata.tags = answers.tags.map(tag => tag.name);
      }
      if ('relations' in answers) {
        taskData.relations = answers.relations.map(relation => ({
          task: relation.task,
          type: relation.type
        }));
      }
      columnName = answers.column;
      createTask(taskData, columnName);
    })
    .catch(error => {
      utility.error(error);
    });

  // Otherwise create task non-interactively
  } else {
    createTask(taskData, columnName);
  }
};
