const workspace = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');
const fuzzy = require('fuzzy');
const chrono = require('chrono-node');

// The boards this command targets - set from --board before anything else runs
let kanbn = workspace;
let boardTargets = [];

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Create a task interactively
 * @param {object} taskData
 * @param {string[]} taskIds
 * @param {string} columnName
 * @param {string[]} columnNames
 * @param {?string} currentUser
 * @param {object[]} contributors
 * @return {Promise<any>}
 */
async function interactiveCreateTask(taskData, taskIds, columnName, columnNames, currentUser, contributors) {
  const dueDateExists = (
    'metadata' in taskData &&
    'due' in taskData.metadata &&
    taskData.metadata.due != null
  );
  const plannedStartDateExists = (
    'metadata' in taskData &&
    'plannedStart' in taskData.metadata &&
    taskData.metadata.plannedStart != null
  );
  const plannedFinishDateExists = (
    'metadata' in taskData &&
    'plannedFinish' in taskData.metadata &&
    taskData.metadata.plannedFinish != null
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
      name: 'setPlannedStart',
      message: 'Set a planned start date?',
      default: false,
      when: answers => !plannedStartDateExists
    },
    {
      type: 'datepicker',
      name: 'plannedStart',
      message: 'Planned start date:',
      default: plannedStartDateExists ? taskData.metadata.plannedStart : new Date(),
      format: ['Y', '/', 'MM', '/', 'DD'],
      when: answers => answers.setPlannedStart,
    },
    {
      type: 'confirm',
      name: 'setPlannedFinish',
      message: 'Set a planned finish date?',
      default: false,
      when: answers => !plannedFinishDateExists
    },
    {
      type: 'datepicker',
      name: 'plannedFinish',
      message: 'Planned finish date:',
      default: plannedFinishDateExists ? taskData.metadata.plannedFinish : new Date(),
      format: ['Y', '/', 'MM', '/', 'DD'],
      when: answers => answers.setPlannedFinish,
    },
    {
      type: 'confirm',
      name: 'setAssigned',
      message: 'Assign this task?',
      default: false,
      when: answers => !assignedExists
    },
    utility.assignedPrompt({
      name: 'assigned',
      message: 'Assigned to:',
      default: assignedExists ? taskData.metadata.assigned : (currentUser || ''),
      when: answers => answers.setAssigned || assignedExists
    }, contributors),
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
async function createTask(taskData, columnName) {
  try {

    // The task is created once, on the first target board, and then added to the others - one task
    // file, referenced by however many boards were named
    const [first, ...rest] = boardTargets;
    const taskId = await first.kanbn.createTask(taskData, columnName);
    console.log(
      `Created task "${taskId}" in column "${columnName}"` +
      (boardTargets.length > 1 || !first.main ? ` on board "${first.slug}"` : '')
    );
    for (const target of rest) {
      await target.kanbn.addTaskToBoard(taskId, target.columnName);
      console.log(`Added task "${taskId}" to column "${target.columnName}" on board "${target.slug}"`);
    }
  } catch (error) {
    utility.error(error);
  }
}

/**
 * Add untracked tasks to the index
 * @param {string[]} untrackedTasks
 * @param {string} columnName
 */
async function addUntrackedTasks(untrackedTasks, columnName) {
  for (const target of boardTargets) {

    // The column chosen interactively or on the command line applies to the first board; the others
    // use whatever resolveBoardTargets() paired them with
    const targetColumn = target === boardTargets[0] ? columnName : target.columnName;
    for (let untrackedTask of untrackedTasks) {
      try {
        await target.kanbn.addUntrackedTaskToIndex(untrackedTask, targetColumn);
      } catch (error) {
        utility.error(error);
        return;
      }
    }
    console.log(
      `Added ${untrackedTasks.length} task${untrackedTasks.length !== 1 ? 's' : ''} ` +
      `to column "${targetColumn}"` + (boardTargets.length > 1 || !target.main ? ` on board "${target.slug}"` : '')
    );
  }
}

module.exports = async args => {

  // Work out which boards this command targets, and which column to use on each. -b is repeatable,
  // so one task can be created and placed on several boards at once
  const targets = await utility.resolveBoardTargets(workspace, args);
  if (targets === null) {
    return;
  }
  boardTargets = targets;
  kanbn = targets[0].kanbn;
  for (const target of boardTargets) {
    target.main = await target.kanbn.isMainBoard();
  }
  utility.showColumnFallbackNotices(boardTargets, kanbn.isVerbose(targets[0].index));

  const index = targets[0].index;
  const columnNames = Object.keys(index.columns);
  const columnName = targets[0].columnName;

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

  // Planned start date
  if (args.plannedStart) {
    taskData.metadata.plannedStart = chrono.parseDate(utility.strArg(args.plannedStart));
    if (taskData.metadata.plannedStart === null) {
      utility.error('Unable to parse plannedStart date');
      return;
    }
  }

  // Planned finish date
  if (args.plannedFinish) {
    taskData.metadata.plannedFinish = chrono.parseDate(utility.strArg(args.plannedFinish));
    if (taskData.metadata.plannedFinish === null) {
      utility.error('Unable to parse plannedFinish date');
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
    if (args.assigned === true) {

      // A bare --assigned means "me", canonicalised against the contributors list if there is one
      const currentUser = await kanbn.currentUser();
      if (currentUser) {
        taskData.metadata.assigned = currentUser;
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
    interactiveCreateTask(
      taskData,
      taskIds,
      columnName,
      columnNames,
      await kanbn.currentUser(),
      await kanbn.getContributors()
    )
    .then(answers => {
      taskData.name = answers.name;
      if ('description' in answers) {
        taskData.description = answers.description;
      }
      if ('due' in answers) {
        taskData.metadata.due = answers.due;
      }
      if ('plannedStart' in answers) {
        taskData.metadata.plannedStart = answers.plannedStart;
      }
      if ('plannedFinish' in answers) {
        taskData.metadata.plannedFinish = answers.plannedFinish;
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
      createTask(taskData, answers.column);
    })
    .catch(error => {
      utility.error(error);
    });

  // Otherwise create task non-interactively
  } else {
    createTask(taskData, columnName);
  }
};
