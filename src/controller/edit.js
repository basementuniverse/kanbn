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
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the task that we're editing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn edit "task id"{b}', true);
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

  // Get the current task data
  let taskData;
  try {
    taskData = await kanbn.getTask(taskId);
  } catch (error) {
    utility.error(error, true);
  }

  // Get column name if specified
  let currentColumnName = await kanbn.findTaskColumn(taskId);
  let columnName = currentColumnName;
  if (args.column) {
    columnName = utility.strArg(args.column);
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`, true);
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
      utility.error('Unable to parse due date', true);
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
        utility.error(`Sub-task "${removedSubTask.text}" doesn't exist`, true);
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
      utility.error('Task has no tags to remove', true);
    }

    // Check that the tags being removed currently exist
    for (let removedTag of removedTags) {
      if (taskData.metadata.tags.indexOf(removedTag) === -1) {
        utility.error(`Tag "${removedSubTask.text}" doesn't exist`, true);
      }
    }
    taskData.tags = taskData.tags.filter(tag => removedTags.indexOf(tag) === -1);
  }

  // Add tags and overwrite existing tags
  if (args.tag) {
    const newTags = utility.arrayArg(args.tag);
    taskData.tags = [...new Set([...taskData.tags, ...newTags])];
  }

  // Remove relations
  if (args['remove-relation']) {
    const removedRelations = utility.arrayArg(args['remove-relation']);

    // Check that the relations being removed currently exist
    for (let removedRelation of removedRelations) {
      if (taskData.relations.find(relation => relation.task === removedRelation.task) === undefined) {
        utility.error(`Relation "${removedRelation.task}" doesn't exist`, true);
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
              utility.error(`Custom field "${arg}" value is not a boolean`, true);
            }
            break;
          case 'number':
            const numberValue = parseFloat(args[arg]);
            if (!isNaN(numberValue)) {
              taskData.metadata[arg] = numberValue;
            } else {
              utility.error(`Custom field "${arg}" value is not a number`, true);
            }
            break;
          case 'string':
            if (typeof args[arg] === 'string') {
              taskData.metadata[arg] = args[arg];
            } else {
              utility.error(`Custom field "${fieldName}" value is not a string`, true);
            }
            break;
          case 'date':
            const dateValue = chrono.parseDate(args[arg]);
            if (dateValue instanceof Date) {
              taskData.metadata[arg] = dateValue;
            } else {
              utility.error(`Unable to parse date for custom field "${arg}"`, true);
            }
            break;
          default: break;
        }
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
        taskData.metadata.due = answers.due.toISOString();
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
      updateTask(taskId, taskData, columnName);
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise edit task non-interactively
  } else {
    columnName = columnName !== currentColumnName ? columnName : null;
    updateTask(taskId, taskData, columnName);
  }
};
