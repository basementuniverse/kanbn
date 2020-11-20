const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const fuzzy = require('fuzzy');
const chrono = require('chrono-node');

inquirer.registerPrompt('datepicker', require('inquirer-datepicker'));
inquirer.registerPrompt('recursive', require('inquirer-recursive'));
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

/**
 * Update a task interactively
 * @param {object} taskData
 * @param {string[]} taskIds
 * @param {string} columnName
 * @param {string[]} columnNames
 */
async function interactive(taskData, taskIds, columnName, columnNames) {
  const dueDateExists = (
    'metadata' in taskData &&
    'due' in taskData.metadata &&
    taskData.metadata.due != null
  );
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Task name:',
      default: taskData.name || '',
      validate: async function (value) {
        if ((/.+/).test(value)) {
          return true;
        }
        return 'Task name cannot be empty';
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
            if ((/.+/).test(value)) {
              return true;
            }
            return 'Sub-task text cannot be empty';
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

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get the task that we're editing
  const taskId = args._[1];
  if (!taskId) {
    console.error(utility.replaceTags('No task id specified. Try running {b}kanbn edit "task id"{b}'));
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.showError(error);
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
  let currentColumnName = findTaskColumn(taskId, index);
  let columnName = currentColumnName;
  if (args.column) {
    if (columnNames.indexOf(args.column) === -1) {
      console.log(`Column "${args.column}" doesn't exist`);
      return;
    }
    columnName = args.column;
  }

  // Get a list of existing task ids
  const taskIds = [...await kanbn.findTrackedTasks()];

  // Get task settings from arguments
  // Name
  if (args.name) {
    taskData.name = args.name;
  }

  // Description
  if (args.description) {
    taskData.description = args.description;
  }

  // Due date
  if (args.due) {
    if (!('metadata' in taskData)) {
      taskData.metadata = {};
    }
    taskData.metadata.due = chrono.parseDate(args.due);
    if (taskData.metadata.due === null) {
      console.log('Unable to parse due date');
      return;
    }
  }

  // Remove sub-tasks
  if (args['remove-sub-task']) {
    const removedSubTasks = Array.isArray(args['remove-sub-task'])
      ? args['remove-sub-task']
      : [args['remove-sub-task']];

    // Check that the sub-tasks being removed currently exist
    for (let removedSubTask of removedSubTasks) {
      if (taskData.subTasks.find(subTask => subTask.text === removedSubTask.text) === undefined) {
        console.log(`Sub-task "${removedSubTask.text}" doesn't exist`);
        return;
      }
    }
    taskData.subTasks = taskData.subTasks.filter(subTask => removedSubTasks.indexOf(subTask.text) === -1);
  }

  // Add or update sub-tasks
  if (args['sub-task']) {
    const newSubTaskInputs = Array.isArray(args['sub-task']) ? args['sub-task'] : [args['sub-task']];
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
    for (let subTask of taskData.subTasks) {

      // If this new sub-task isn't already in the task, add it to the task
      if (newSubTasks.find(newSubTask => newSubTask.text === subTask.text) === undefined) {
        taskData.subTasks.push(newSubTask);

      // Otherwise, update the existing sub-task completed status
      } else {
        subTask.completed = newSubTask.completed;
      }
    }
  }

  // Remove tags
  if (args['remove-tag']) {
    const removedTags = Array.isArray(args['remove-tag']) ? args['remove-tag'] : [args['remove-tag']];

    // Check that the task has metadata
    if (!('metadata' in taskData) || !('tags' in taskData.metadata) || !Array.isArray(taskData.metadata.tags)) {
      console.log('Task has no tags to remove');
      return;
    }

    // Check that the tags being removed currently exist
    for (let removedTag of removedTags) {
      if (taskData.metadata.tags.indexOf(removedTag) === -1) {
        console.log(`Tag "${removedSubTask.text}" doesn't exist`);
        return;
      }
    }
    taskData.tags = taskData.tags.filter(tag => removedTags.indexOf(tag) === -1);
  }

  // Add tags and overwrite existing tags
  if (args.tag) {
    const newTags = Array.isArray(args.tag) ? args.tag : [args.tag];
    taskData.tags = [...new Set([...taskData.tags, ...newTags])];
  }

  // Remove relations
  if (args['remove-relation']) {
    const removedRelations = Array.isArray(args['remove-relation'])
      ? args['remove-relation']
      : [args['remove-relation']];

    // Check that the relations being removed currently exist
    for (let removedRelation of removedRelations) {
      if (taskData.relations.find(relation => relation.task === removedRelation.task) === undefined) {
        console.log(`Relation "${removedRelation.task}" doesn't exist`);
        return;
      }
    }
    taskData.relations = taskData.relations.filter(relation => removedRelations.indexOf(relation.task) === -1);
  }

  // Add or update relations
  if (args.relation) {
    const newRelationInputs = Array.isArray(args.relation) ? args.relation : [args.relation];
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
    for (let relation of taskData.relations) {

      // If this new relation isn't already in the task, add it to the task
      if (newRelations.find(newRelation => newRelation.task === relation.task) === undefined) {
        taskData.relations.push(newRelation);

      // Otherwise, update the existing relation type
      } else {
        relation.type = newRelation.type;
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

      // Due date
      if ('due' in answers) {
        taskData.metadata.due = answers.due.toISOString();
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
        for (editTag of answers.editTags) {
          const i = taskData.metadata.tags.indexOf(editTag.name);
          if (i !== -1) {
            taskData.metadata.tags.splice(i, 1);
          }
        }
      }

      // Add tags
      if ('addTags' in answers && 'metadata' in taskData && 'tags' in taskData.metadata) {
        taskData.metadata.tags.push(...answers.map(tag => tag.name));
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
      columnName = answers.column !== currentColumn ? answers.column : null;
      updateTask(taskId, taskData, columnName);
    })
    .catch(error => {
      utility.showError(error);
    });

  // Otherwise edit task non-interactively
  } else {
    columnName = columnName !== currentColumn ? columnName : null;
    updateTask(taskId, taskData, columnName);
  }
};
