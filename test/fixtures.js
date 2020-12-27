const mockFileSystem = require('mock-fs');
const faker = require('faker');
const parseIndex = require('../src/parse-index');
const parseTask = require('../src/parse-task');
const utility = require('../src/utility');

/**
 * Generate a random task
 * @param {number} i The task index
 * @return {object} A random task object
 */
function generateTask(i) {
  const COUNT_TAGS = faker.random.number(5);

  return {
    name: `Task ${i + 1}`,
    description: faker.lorem.paragraph(),
    metadata: {
      created: faker.date.past(),
      update: faker.date.past(),
      due: faker.date.future(),
      tags: new Array(COUNT_TAGS).fill(null).map(i => faker.lorem.word())
    },
    subTasks: generateSubTasks(),
    relations: []
  };
}

/**
 * Generate random sub-tasks
 * @return {object[]} Random sub-tasks
 */
function generateSubTasks() {
  const COUNT_SUB_TASKS = faker.random.number(10);

  return new Array(COUNT_SUB_TASKS).fill(null).map(i => ({
    text: faker.lorem.sentence(),
    completed: faker.random.boolean()
  }));
}

/**
 * Generate random relations
 * @param {} taskIds A list of existing task ids
 * @return {object[]} Random relations
 */
function addRelations(taskIds) {
  const COUNT_RELATIONS = faker.random.number(4);

  const relationTypes = ['', 'blocks ', 'duplicates ', 'requires ', 'obsoletes '];
  return new Array(COUNT_RELATIONS).fill(null).map(i => ({
    task: taskIds[Math.floor(Math.random() * taskIds.length)],
    type: relationTypes[Math.floor(Math.random() * relationTypes.length)]
  }));
}

/**
 * @typedef {object} fixtureOptions
 * @property {object[]} tasks A list of tasks to use
 * @property {object} columns A columns object to use
 * @property {object} options Options to put in the index
 * @property {object} countColumns The number of columns to generate (will be called 'Column 1', 'Column 2' etc.)
 * @property {number} countTasks The number of tasks to generate (will be called 'Task 1', 'Task 2' etc.)
 * @property {number} columnNames An array of column names to use (use with countColumns)
 * @property {number} tasksPerColumn The number of tasks to put in each column, -1 to put all tasks in the first
 * column
 */

/**
 * Generate an index and tasks
 * @param {fixtureOptions} [options={}]
 */
module.exports = (options = {}) => {
  let tasks, taskIds, columns;

  // Generate tasks
  if ('tasks' in options) {
    tasks = new Array(options.tasks.length).fill(null).map((v, i) => Object.assign(
      options.noRandom ? {} : generateTask(i),
      options.tasks[i]
    ));
    taskIds = tasks.filter(i => !i.untracked).map(i => utility.getTaskId(i.name));
  } else {
    const COUNT_TASKS = options.countTasks || faker.random.number(9) + 1;
    tasks = new Array(COUNT_TASKS).fill(null).map((v, i) => generateTask(i));
    taskIds = tasks.filter(i => !i.untracked).map(i => utility.getTaskId(i.name));
    tasks.forEach(i => addRelations(taskIds));
  }

  // Generate and populate columns
  if ('columns' in options) {
    columns = options.columns;
  } else {
    const COUNT_COLUMNS = options.countColumns || faker.random.number(4) + 1;
    const TASKS_PER_COLUMN = options.tasksPerColumn || -1;
    const columnNames = options.columnNames || new Array(COUNT_COLUMNS).fill(null).map((v, i) => `Column ${i + 1}`);
    columns = Object.fromEntries(columnNames.map(i => [i, []]));
    let currentColumn = 0;
    for (let taskId of taskIds) {
      if (TASKS_PER_COLUMN === -1) {
        columns[columnNames[0]].push(taskId);
      } else {
        if (columns[columnNames[currentColumn]].length === TASKS_PER_COLUMN) {
          currentColumn = (currentColumn + 1) % columnNames.length;
        }
        columns[columnNames[currentColumn]].push(taskId);
      }
    }
  }

  // Generate index
  const index = {
    name: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    columns
  };
  if ('options' in options) {
    index.options = options.options;
  }

  // Generate in-memory files
  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md(index),
      'tasks': Object.fromEntries(tasks.map(i => [`${utility.getTaskId(i.name)}.md`, parseTask.json2md(i)]))
    }
  });

  return index;
};
