const kanbn = require('../main');
const utility = require('../utility');
const parseTask = require('../parse-task');
const Spinner = require('cli-spinner').Spinner;
const cliMd = require('cli-markdown');

/**
 * Show task information
 * @param {string} taskId
 */
function showTask(taskId, json = false) {
  const spinner = new Spinner('Loading task...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .getTask(taskId)
  .then(task => {
    spinner.stop(true);
    if (json) {
      console.log(task);
    } else {
      console.log(cliMd(parseTask.json2md(task)));
    }
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the task that we're showing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn task "task id"{b}', true);
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error, true);
  }

  // Show the task
  showTask(taskId, args.json);
};
