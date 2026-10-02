const workspace = require('../main');
const utility = require('../utility');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

/**
 * Archive a task
 * @param {string} taskId
 */
function archiveTask(taskId) {
  kanbn
  .archiveTask(taskId)
  .then(taskId => {
    console.log(`Archived task "${taskId}"`);
    utility.showActionWarnings(kanbn);
  })
  .catch(error => {
    utility.error(error);
  });
}

/**
 * Show a list of archived task filenames
 */
function listArchivedTasks() {
  kanbn
  .listArchivedTasks()
  .then(archivedTasks => {
    console.log(archivedTasks.join('\n'));
  })
  .catch(error => {
    utility.error(error);
  });
}

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

  // Check if we're listing archived tasks
  if (args.list) {
    listArchivedTasks();
    return;
  }

  // Get the task that we're archiving
  // Destructive, so only an exact id until resolving a partial one asks for confirmation first
  const taskId = await utility.resolveTaskArg(kanbn, args, 'archive', { inexact: false });
  if (taskId === null) {
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
