const workspace = require('../main');
const utility = require('../utility');
const board = require('../board');

module.exports = async args => {

  // Work out which board we're showing
  const kanbn = await utility.resolveBoard(workspace, args);
  if (kanbn === null) {
    return;
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error);
    return;
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    utility.error('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}');
    return;
  }

  // Load and hydrate all tracked tasks
  const tasks = (await kanbn.loadAllTrackedTasks(index)).map(
    task => kanbn.hydrateTask(index, task)
  );

  // Show the board
  board
  .show(index, tasks, args.view, args.json)
  .then(async () => {
    const verbose = !args.json && kanbn.isVerbose(index);
    utility.showDateDriftHint(kanbn.getDateDrift(index, tasks), verbose);
    utility.showBoardCountHint(await workspace.listBoards(), verbose);
  })
  .catch(error => {
    utility.error(error);
  });
};
