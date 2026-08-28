const workspace = require("../main");
const utility = require("../utility");
const parseTask = require("../parse-task");
const marked = require("marked");
const markedTerminalRenderer = require("marked-terminal");

/**
 * Show task information
 * @param {object} kanbn The board-scoped kanbn instance
 * @param {string} taskId
 * @param {Record<string, string>} boards The boards this task appears on, and the column on each
 * @param {boolean} json
 */
function showTask(kanbn, taskId, boards, json = false) {
  kanbn
    .getTask(taskId)
    .then((task) => {
      if (json) {
        console.log(JSON.stringify({ ...task, boards }, null, 2));
      } else {
        marked.setOptions({
          renderer: new markedTerminalRenderer(),
        });

        // Board membership isn't part of the task file - boards own membership, not tasks - so it's
        // appended here rather than rendered from the task itself. Only worth showing once there is
        // more than one board to be a member of
        const boardSlugs = Object.keys(boards);
        const boardsSection =
          boardSlugs.length > 1
            ? `\n## Boards\n\n${boardSlugs.map((slug) => `- ${slug}: ${boards[slug]}`).join("\n")}\n`
            : "";
        console.log(marked.parse(parseTask.json2md(task) + boardsSection));
      }
    })
    .catch((error) => {
      utility.error(error);
    });
}

module.exports = async (args) => {

  // Work out which board this command targets
  const kanbn = await utility.resolveBoard(workspace, args);
  if (kanbn === null) {
    return;
  }

  // Get the task that we're showing
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn task "task id"{b}');
    return;
  }

  // Make sure the task exists. A line in a column that isn't a task link has no task file to show,
  // so say what it is and how to turn it into one rather than reporting a missing file
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    if (!(await kanbn.taskFileExists(taskId))) {
      const matches = await kanbn.findSimpleTasks(taskId);
      if (matches.length === 1) {
        utility.error(
          `"${matches[0].text}" is a simple task in column "${matches[0].column}" - it has no task file\n` +
          `Run {b}kanbn edit "${matches[0].text}"{b} to promote it to a task`
        );
        return;
      }
    }
    utility.error(error);
    return;
  }

  // Show the task, along with the boards it appears on
  showTask(kanbn, taskId, await workspace.findTaskBoards(taskId), args.json);
};
