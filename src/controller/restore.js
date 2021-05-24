const kanbn = require('../main');
const utility = require('../utility');

/**
 * Restore a task from the archive
 * @param {string} taskId
 */
function restoreTask(taskId) {
  kanbn
  .restoreTask(taskId)
  .then(taskId => {
    console.log(`Restored task "${taskId}" from the archive`);
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

  // Get the task that we're archiving
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn restore "task id"{b}');
    return;
  }

  // Archive task
  restoreTask(taskId);
};
