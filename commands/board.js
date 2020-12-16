const kanbn = require('../src/main');
const utility = require('../src/utility');
const board = require('../src/board');
const Spinner = require('cli-spinner').Spinner;

module.exports = async args => {

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

  // If not showing the board quietly, load all tracked tasks
  let tasks = null;
  if (!args.quiet) {
    const spinner = new Spinner('Loading tasks...');
    spinner.setSpinnerString(18);
    spinner.start();

    // Load and hydrate all tracked tasks
    const trackedTaskPromises = [...await kanbn.findTrackedTasks()].map(
      async taskId => kanbn.hydrateTask(index, await kanbn.getTask(taskId))
    );
    tasks = await Promise.all(trackedTaskPromises);
    spinner.stop(true);
  }

  // Show the board
  await board.show(index, tasks);
};
