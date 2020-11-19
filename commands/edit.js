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
      name: 'editDescription',
      message: 'Edit description?'
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

    // here: need to choose sub-tasks/tags/relations and add/edit/remove them
    // {
    //   type: 'recursive',
    //   name: 'subTasks',
    //   message: 'Add a sub-task?',
    //   default: false,
    //   prompts: [
    //     {
    //       type: 'input',
    //       name: 'subTaskTitle',
    //       message: 'Sub-task title:',
    //       validate: value => {
    //         if ((/.+/).test(value)) {
    //           return true;
    //         }
    //         return 'Sub-task title cannot be empty';
    //       }
    //     }
    //   ]
    // },
    // {
    //   type: 'recursive',
    //   name: 'tags',
    //   message: 'Add a tag?',
    //   default: false,
    //   prompts: [
    //     {
    //       type: 'input',
    //       name: 'tagName',
    //       message: 'Tag:',
    //       validate: value => {
    //         if ((/.+/).test(value)) {
    //           return true;
    //         }
    //         return 'Tag name cannot be empty';
    //       }
    //     }
    //   ]
    // },
    // {
    //   type: 'recursive',
    //   name: 'relations',
    //   message: 'Add a relation?',
    //   default: false,
    //   when: answers => trackedTasks.length > 0,
    //   prompts: [
    //     {
    //       type: 'autocomplete',
    //       name: 'relatedTaskId',
    //       message: 'Task id:',
    //       source: (answers, input) => {
    //         input = input || '';
    //         const result = fuzzy.filter(input, trackedTasks);
    //         return new Promise(resolve => {
    //           resolve(result.map(result => result.string));
    //         });
    //       }
    //     },
    //     {
    //       type: 'input',
    //       name: 'relationType',
    //       message: 'Type:'
    //     }
    //   ]
    // }
  ]);
  // TODO finish task interactive update
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
  // Title
  if (args.title) {
    taskData.title = args.title;
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
      const parts = relation.split(':');
      return parts.length === 1
        ? {
          type: '',
          task: parts[0]
        }
        : {
          type: parts[0],
          task: parts[1]
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
    interactive(taskData, columnName, columnNames)
    .then(answers => {
      console.log(answers);
      return;

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
      //     completed: false
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
      updateTask(taskId, taskData, columnName);
    })
    .catch(error => {
      utility.showError(error);
    });

  // Otherwise edit task non-interactively
  } else {
    console.log('editing...');
    columnName = columnName !== currentColumn ? columnName : null;
    // updateTask(taskId, taskData, columnName);
  }
};
