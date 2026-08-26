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
 * Update a task interactively
 * @param {object} taskData
 * @param {string[]} taskIds
 * @param {string} columnName
 * @param {string[]} columnNames
 * @return {Promise<any>}
 */
async function interactive(taskData, taskIds, columnName, columnNames) {
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
      name: 'editDescription',
      message: 'Edit description?',
      default: false
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Task description:',
      default: taskData.description,
      when: answers => answers.editDescription
    },
    {
      type: 'list',
      name: 'column',
      message: 'Column:',
      default: columnName,
      choices: columnNames
    },
    {
      type: 'expand',
      name: 'editDue',
      message: 'Edit or remove due date?',
      default: 'none',
      when: answers => dueDateExists,
      choices: [
        {
          key: 'e',
          name: 'Edit',
          value: 'edit'
        },
        {
          key: 'r',
          name: 'Remove',
          value: 'remove'
        },
        new inquirer.Separator(),
        {
          key: 'n',
          name: 'Do nothing',
          value: 'none'
        }
      ]
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
      when: answers => answers.setDue || answers.editDue === 'edit'
    },
    {
      type: 'expand',
      name: 'editPlannedStart',
      message: 'Edit or remove planned start date?',
      default: 'none',
      when: answers => plannedStartDateExists,
      choices: [
        {
          key: 'e',
          name: 'Edit',
          value: 'edit'
        },
        {
          key: 'r',
          name: 'Remove',
          value: 'remove'
        },
        new inquirer.Separator(),
        {
          key: 'n',
          name: 'Do nothing',
          value: 'none'
        }
      ]
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
      when: answers => answers.setPlannedStart || answers.editPlannedStart === 'edit'
    },
    {
      type: 'expand',
      name: 'editPlannedFinish',
      message: 'Edit or remove planned finish date?',
      default: 'none',
      when: answers => plannedFinishDateExists,
      choices: [
        {
          key: 'e',
          name: 'Edit',
          value: 'edit'
        },
        {
          key: 'r',
          name: 'Remove',
          value: 'remove'
        },
        new inquirer.Separator(),
        {
          key: 'n',
          name: 'Do nothing',
          value: 'none'
        }
      ]
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
      when: answers => answers.setPlannedFinish || answers.editPlannedFinish === 'edit'
    },
    {
      type: 'expand',
      name: 'editAssigned',
      message: 'Edit or remove assigned user?',
      default: 'none',
      when: answers => assignedExists,
      choices: [
        {
          key: 'e',
          name: 'Edit',
          value: 'edit'
        },
        {
          key: 'r',
          name: 'Remove',
          value: 'remove'
        },
        new inquirer.Separator(),
        {
          key: 'n',
          name: 'Do nothing',
          value: 'none'
        }
      ]
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
      when: answers => answers.setAssigned || answers.editAssigned === 'edit'
    },
    {
      type: 'recursive',
      name: 'addSubTasks',
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
      name: 'editSubTasks',
      initialMessage: 'Update or remove a sub-task?',
      message: 'Update or remove another sub-task?',
      default: false,
      when: answers => taskData.subTasks.length > 0,
      prompts: [
        {
          type: 'list',
          name: 'selectSubTask',
          message: 'Which sub-task do you want to update or remove?',
          choices: taskData.subTasks.map(subTask => subTask.text)
        },
        {
          type: 'expand',
          name: 'editSubTask',
          message: 'Edit completion status or remove sub-task?',
          default: 'none',
          choices: [
            {
              key: 'e',
              name: 'Edit completion status',
              value: 'edit'
            },
            {
              key: 'r',
              name: 'Remove',
              value: 'remove'
            },
            new inquirer.Separator(),
            {
              key: 'n',
              name: 'Do nothing',
              value: 'none'
            }
          ]
        },
        {
          type: 'confirm',
          name: 'completed',
          message: 'Sub-task completed?',
          default: answers => taskData.subTasks.find(subTask => subTask.text === answers.selectSubTask).completed,
          when: answers => answers.editSubTask === 'edit'
        }
      ]
    },
    {
      type: 'recursive',
      name: 'addTags',
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
      name: 'removeTags',
      initialMessage: 'Remove a tag?',
      message: 'Remove another tag?',
      default: false,
      when: answers => (
        'metadata' in taskData &&
        'tags' in taskData.metadata &&
        taskData.metadata.tags.length > 0
      ),
      prompts: [
        {
          type: 'list',
          name: 'selectTag',
          message: 'Which tag do you want to remove?',
          choices: taskData.metadata.tags
        }
      ]
    },
    {
      type: 'recursive',
      name: 'addRelations',
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
    },
    {
      type: 'recursive',
      name: 'editRelations',
      initialMessage: 'Update or remove a relation?',
      message: 'Update or remove another relation?',
      default: false,
      when: answers => taskData.relations.length > 0,
      prompts: [
        {
          type: 'list',
          name: 'selectRelation',
          message: 'Which relation do you want to update or remove?',
          choices: taskData.relations.map(relation => relation.task)
        },
        {
          type: 'expand',
          name: 'editRelation',
          message: 'Edit relation type or remove relation?',
          default: 'none',
          choices: [
            {
              key: 'e',
              name: 'Edit relation type',
              value: 'edit'
            },
            {
              key: 'r',
              name: 'Remove',
              value: 'remove'
            },
            new inquirer.Separator(),
            {
              key: 'n',
              name: 'Do nothing',
              value: 'none'
            }
          ]
        },
        {
          type: 'input',
          name: 'type',
          message: 'Relation type:',
          default: answers => taskData.relations.find(relation => relation.task === answers.selectRelation).task,
          when: answers => answers.editRelation === 'edit'
        }
      ]
    }
  ]);
}

/**
 * Metadata fields that can be cleared with --unset, in addition to any custom fields defined in
 * the index options
 */
const UNSETTABLE_FIELDS = [
  'started',
  'completed',
  'due',
  'plannedStart',
  'plannedFinish',
  'assigned',
  'progress',
  'tags'
];

/**
 * Update a task
 * @param {string} taskId
 * @param {object} taskData
 * @param {?string} columnName
 * @param {string[]} [unsetFields=[]]
 */
function updateTask(taskId, taskData, columnName, unsetFields = []) {
  kanbn
  .updateTask(taskId, taskData, columnName, unsetFields)
  .then(taskId => {
    console.log(`Updated task "${taskId}"`);
  })
  .catch(error => {
    utility.error(error);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }

  // Get the task that we're editing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn edit "task id"{b}');
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error);
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

  // Get the current task data
  let taskData;
  try {
    taskData = await kanbn.getTask(taskId);
  } catch (error) {
    utility.error(error);
    return;
  }

  // Get column name if specified
  let currentColumnName = await kanbn.findTaskColumn(taskId);
  let columnName = currentColumnName;
  if (args.column) {
    columnName = utility.strArg(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`);
      return;
    }
  }

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
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    taskData.metadata.due = chrono.parseDate(utility.strArg(args.due));
    if (taskData.metadata.due === null) {
      utility.error('Unable to parse due date');
      return;
    }
  }

  // Planned start date
  if (args.plannedStart) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    taskData.metadata.plannedStart = chrono.parseDate(utility.strArg(args.plannedStart));
    if (taskData.metadata.plannedStart === null) {
      utility.error('Unable to parse plannedStart date');
      return;
    }
  }

  // Planned finish date
  if (args.plannedFinish) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    taskData.metadata.plannedFinish = chrono.parseDate(utility.strArg(args.plannedFinish));
    if (taskData.metadata.plannedFinish === null) {
      utility.error('Unable to parse plannedFinish date');
      return;
    }
  }

  // Progress
  if (args.progress) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    const progressValue = parseFloat(utility.strArg(args.progress));
    if (isNaN(progressValue)) {
      utility.error('Progress value is not a number');
      return;
    }
    taskData.metadata.progress = progressValue;
  }

  // Assigned
  if (args.assigned) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    const gitUsername = getGitUsername();
    if (args.assigned === true) {
      if (gitUsername) {
        taskData.metadata.assigned = gitUsername;
      }
    } else {
      taskData.metadata.assigned = utility.strArg(args.assigned);
    }
  }

  // Remove sub-tasks
  if (args['remove-sub-task']) {
    const removedSubTasks = utility.arrayArg(args['remove-sub-task']);

    // Check that the sub-tasks being removed currently exist
    for (let removedSubTask of removedSubTasks) {
      if (taskData.subTasks.find(subTask => subTask.text === removedSubTask.text) === undefined) {
        utility.error(`Sub-task "${removedSubTask.text}" doesn't exist`);
        return;
      }
    }
    taskData.subTasks = taskData.subTasks.filter(subTask => removedSubTasks.indexOf(subTask.text) === -1);
  }

  // Add or update sub-tasks
  if (args['sub-task']) {
    const newSubTaskInputs = utility.arrayArg(args['sub-task']);
    const newSubTasks = newSubTaskInputs.map(subTask => {
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

    // Add or update
    for (let newSubTask of newSubTasks) {

      // Check if a sub-task already exists in the task with matching text
      const foundSubTask = taskData.subTasks.find(subTask => subTask.text === newSubTask.text);
      if (foundSubTask === undefined) {

        // The sub-task doesn't already exist
        taskData.subTasks.push(newSubTask);

      // Otherwise, the sub-task already exists so update its completed status
      } else {
        foundSubTask.completed = newSubTask.completed;
      }
    }
  }

  // Remove tags
  if (args['remove-tag']) {
    const removedTags = utility.arrayArg(args['remove-tag']);

    // Check that the task has metadata
    if (!('metadata' in taskData) || !('tags' in taskData.metadata) || !Array.isArray(taskData.metadata.tags)) {
      utility.error('Task has no tags to remove');
      return;
    }

    // Check that the tags being removed currently exist
    for (let removedTag of removedTags) {
      if (taskData.metadata.tags.indexOf(removedTag) === -1) {
        utility.error(`Tag "${removedSubTask.text}" doesn't exist`);
        return;
      }
    }
    taskData.metadata.tags = taskData.metadata.tags.filter(tag => removedTags.indexOf(tag) === -1);
  }

  // Add tags and overwrite existing tags
  if (args.tag) {
    const newTags = utility.arrayArg(args.tag);
    taskData.metadata.tags = [...new Set([...taskData.metadata.tags || [], ...newTags])];
  }

  // Remove relations
  if (args['remove-relation']) {
    const removedRelations = utility.arrayArg(args['remove-relation']);

    // Check that the relations being removed currently exist
    for (let removedRelation of removedRelations) {
      if (taskData.relations.find(relation => relation.task === removedRelation.task) === undefined) {
        utility.error(`Relation "${removedRelation.task}" doesn't exist`);
        return;
      }
    }
    taskData.relations = taskData.relations.filter(relation => removedRelations.indexOf(relation.task) === -1);
  }

  // Add or update relations
  if (args.relation) {
    const newRelationInputs = utility.arrayArg(args.relation);
    const newRelations = newRelationInputs.map(relation => {
      const parts = relation.split(' ');
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

    // Add or update
    for (let newRelation of newRelations) {

      // Check if a relation already exists in the task with matching task id
      const foundRelation = taskData.relations.find(relation => relation.task === newRelation.task);
      if (foundRelation === undefined) {

        // The relation doesn't already exist
        taskData.relations.push(newRelation);

      // Otherwise, the relation already exists so update its relation type
      } else {
        foundRelation.type = newRelation.type;
      }
    }
  }

  // Check custom field types
  if ('customFields' in index.options) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    for (let arg of Object.keys(args)) {

      // Check if we're removing a custom field
      const removeCustomField = index.options.customFields.find(p => `remove-${p.name}` === arg);
      if (removeCustomField !== undefined) {
        if (removeCustomField.name in taskData.metadata) {
          delete taskData.metadata[removeCustomField.name];
        }
      }

      // Check if we're adding or modifying a custom field
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
              utility.error(`Custom field "${fieldName}" value is not a string`);
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

  // Unset metadata fields
  const unsetFields = [];
  if (args.unset) {
    const customFieldNames = 'customFields' in index.options
      ? index.options.customFields.map(customField => customField.name)
      : [];
    const unsettableFields = [...UNSETTABLE_FIELDS, ...customFieldNames];

    // Arguments that set the value of a metadata field, so that setting and unsetting the same
    // field in one command can be rejected instead of silently resolving one way or the other
    const settingArgs = {
      due: args.due,
      plannedStart: args.plannedStart,
      plannedFinish: args.plannedFinish,
      progress: args.progress,
      assigned: args.assigned,
      tags: args.tag,
      ...Object.fromEntries(customFieldNames.map(name => [name, args[name]]))
    };

    for (let field of utility.arrayArg(args.unset)) {
      if (unsettableFields.indexOf(field) === -1) {
        utility.error(
          `Cannot unset "${field}"\nAvailable fields: ${unsettableFields.join(', ')}`
        );
        return;
      }
      if (settingArgs[field] !== undefined) {
        utility.error(`Cannot set and unset "${field}" in the same command`);
        return;
      }
      if (unsetFields.indexOf(field) === -1) {
        unsetFields.push(field);
      }
    }
  }

  // Update task interactively
  if (args.interactive) {
    interactive(taskData, taskIds, columnName, columnNames)
    .then(answers => {

      // Name
      taskData.name = answers.name;

      // Description
      if ('description' in answers) {
        taskData.description = answers.description;
      }

      // Remove due date
      if ('editDue' in answers && answers.editDue === 'remove') {
        delete taskData.metadata.due;
      }

      // Due date
      if ('due' in answers) {
        taskData.metadata.due = answers.due;
      }

      // Remove planned start date
      if ('editPlannedStart' in answers && answers.editPlannedStart === 'remove') {
        delete taskData.metadata.plannedStart;
      }

      // Planned start date
      if ('plannedStart' in answers) {
        taskData.metadata.plannedStart = answers.plannedStart;
      }

      // Remove planned finish date
      if ('editPlannedFinish' in answers && answers.editPlannedFinish === 'remove') {
        delete taskData.metadata.plannedFinish;
      }

      // Planned finish date
      if ('plannedFinish' in answers) {
        taskData.metadata.plannedFinish = answers.plannedFinish;
      }

      // Remove assigned
      if ('editAssigned' in answers && answers.editAssigned === 'remove') {
        delete taskData.metadata.assigned;
      }

      // Assigned
      if ('assigned' in answers) {
        taskData.metadata.assigned = answers.assigned;
      }

      // Edit or remove sub-tasks
      if ('editSubTasks' in answers) {
        for (editSubTask of answers.editSubTasks) {
          const i = taskData.subTasks.findIndex(subTask => subTask.task === editSubTask.selectSubTask);
          if (i !== -1) {
            switch (editSubTask.editSubTask) {
              case 'remove':
                taskData.subTasks.splice(i, 1);
                break;
              case 'edit':
                taskData.subTasks[i].completed = editSubTask.completed;
                break;
              default:
                break;
            }
          }
        }
      }

      // Add sub-tasks
      if ('addSubTasks' in answers) {
        taskData.subTasks.push(...answers.addSubTasks.map(addSubTask => ({
          text: addSubTask.text,
          completed: addSubTask.completed
        })));
      }

      // Remove tags
      if ('removeTags' in answers && 'metadata' in taskData && 'tags' in taskData.metadata) {
        for (removeTag of answers.removeTags) {
          const i = taskData.metadata.tags.indexOf(removeTag.name);
          if (i !== -1) {
            taskData.metadata.tags.splice(i, 1);
          }
        }
      }

      // Add tags
      if ('addTags' in answers && 'metadata' in taskData && 'tags' in taskData.metadata) {
        taskData.metadata.tags.push(...answers.addTags.map(tag => tag.name));
      }

      // Edit or remove relations
      if ('editRelations' in answers) {
        for (editRelation of answers.editRelations) {
          const i = taskData.relations.findIndex(relation => relation.task === editRelation.selectRelation);
          if (i !== -1) {
            switch (editRelation.editRelation) {
              case 'remove':
                taskData.relations.splice(i, 1);
                break;
              case 'edit':
                taskData.relations[i].type = editRelation.type;
                break;
              default:
                break;
            }
          }
        }
      }

      // Add relations
      if ('addRelations' in answers) {
        taskData.relations.push(...answers.addRelations.map(addRelation => ({
          task: addRelation.task,
          type: addRelation.type
        })));
      }

      // Update task
      columnName = answers.column !== currentColumnName ? answers.column : null;
      updateTask(taskId, taskData, columnName, unsetFields);
    })
    .catch(error => {
      utility.error(error);
    });

  // Otherwise edit task non-interactively
  } else {
    columnName = columnName !== currentColumnName ? columnName : null;
    updateTask(taskId, taskData, columnName, unsetFields);
  }
};
