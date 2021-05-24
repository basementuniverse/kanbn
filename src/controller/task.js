const kanbn = require("../main");
const utility = require("../utility");
const parseTask = require("../parse-task");
const marked = require("marked");
const markedTerminalRenderer = require("marked-terminal");

/**
 * Show task information
 * @param {string} taskId
 */
function showTask(taskId, json = false) {
  kanbn
    .getTask(taskId)
    .then((task) => {
      if (json) {
        console.log(task);
      } else {
        marked.setOptions({
          renderer: new markedTerminalRenderer(),
        });
        console.log(marked(parseTask.json2md(task)));
      }
    })
    .catch((error) => {
      utility.error(error);
    });
}

module.exports = async (args) => {
  // Make sure kanbn has been initialised
  if (!(await kanbn.initialised())) {
    utility.error("Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}");
    return;
  }

  // Get the task that we're showing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn task "task id"{b}');
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error);
    return;
  }

  // Show the task
  showTask(taskId, args.json);
};
