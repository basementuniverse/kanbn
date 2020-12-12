const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const board = require('./board');
const Spinner = require('cli-spinner').Spinner;
const term = require('terminal-kit').terminal;
const cliMd = require('cli-markdown');

async function render(term, index, tasks, selectedTaskId) {
  term.fullscreen();

  // Show project name and description
  term.moveTo(1, 1);
  term.bold.underline(index.name);
  term.moveTo(1, 3);
  console.log(cliMd(index.description));

  // Show board columns
  await board.show(index, tasks, selectedTaskId);
}

function wrap(array, i) {
  const l = array.length;
  return array[i < 0 ? l - (Math.abs(i + 1) % l) - 1 : i % l];
}

function findTopLeftTask(index) {
  for (let column in index.columns) {
    for (let task of index.columns[column]) {
      return task;
    }
  }
  return null;
}

function findAdjacentTask(index, taskId, direction) {
  if (taskId === null) {
    return findTopLeftTask(index);
  }
  const columns = Object.keys(index.columns);
  let currentColumnIndex = null, currentTaskIndex = null;
  for (let columnName in index.columns) {
    const i = index.columns[columnName].indexOf(taskId);
    if (i !== -1) {
      currentColumnIndex = columns.indexOf(columnName);
      currentTaskIndex = i;
    }
  }
  switch (direction) {
    case 'UP':
      return wrap(index.columns[columns[currentColumnIndex]], currentTaskIndex - 1);
    case 'DOWN':
      return wrap(index.columns[columns[currentColumnIndex]], currentTaskIndex + 1);
    case 'LEFT':
      while (index.columns[wrap(columns, --currentColumnIndex)].length === 0) {}
      return index.columns[wrap(columns, currentColumnIndex)][Math.min(
        index.columns[wrap(columns, currentColumnIndex)].length - 1,
        currentTaskIndex
      )];
    case 'RIGHT':
      while (index.columns[wrap(columns, ++currentColumnIndex)].length === 0) {}
      return index.columns[wrap(columns, currentColumnIndex)][Math.min(
        index.columns[wrap(columns, currentColumnIndex)].length - 1,
        currentTaskIndex
      )];
    default:
      break;
  }
  return null;
}

module.exports = async () => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
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

  // Load and hydrate all tracked tasks
  const spinner = new Spinner('Loading tasks...');
  spinner.setSpinnerString(18);
  spinner.start();
  const trackedTaskPromises = [...await kanbn.findTrackedTasks()].map(
    async taskId => kanbn.hydrateTask(index, await kanbn.getTask(taskId))
  );
  const tasks = await Promise.all(trackedTaskPromises);
  spinner.stop(true);

  // Select top-left-most task
  let selectedTaskId = findTopLeftTask(index);

  // Initialise terminal interface
  term.grabInput();
  term.fullscreen();

  // Handle input
  term.on('key', async (key, matches, data) => {
    // console.log("'key' event:", key);
    switch (key) {

      // Ctrl-C to exit
      case 'CTRL_C':
        term.fullscreen(false);
        process.exit();
      case 'UP':
        selectedTaskId = findAdjacentTask(index, selectedTaskId, 'UP');
        await render(term, index, tasks, selectedTaskId);
        break;
      case 'DOWN':
        selectedTaskId = findAdjacentTask(index, selectedTaskId, 'DOWN');
        await render(term, index, tasks, selectedTaskId);
        break;
      case 'LEFT':
        selectedTaskId = findAdjacentTask(index, selectedTaskId, 'LEFT');
        await render(term, index, tasks, selectedTaskId);
        break;
      case 'RIGHT':
        selectedTaskId = findAdjacentTask(index, selectedTaskId, 'RIGHT');
        await render(term, index, tasks, selectedTaskId);
        break;
      default:
        break;
    }
  });

  // Handle resize
  term.on('resize', async (width, height) => {
    await render(term, index, tasks, selectedTaskId);
  });
  await render(term, index, tasks, selectedTaskId);
};
