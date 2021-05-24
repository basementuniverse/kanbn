const kanbn = require('../main');
const utility = require('../utility');

/**
 * Archive a task
 * @param {string} taskId
 */
function archiveTask(taskId) {
  kanbn
  .archiveTask(taskId)
  .then(taskId => {
    console.log(`Archived task "${taskId}"`);
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
    utility.error('No task id specified\nTry running {b}kanbn archive "task id"{b}');
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error);
    return;
  }

  // Archive task
  archiveTask(taskId);
};
