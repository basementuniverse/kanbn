const workspace = require('../main');
const utility = require('../utility');
const yaml = require('yamljs');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

/**
 * Show a list of tasks whose dates disagree with the column they're in
 * @param {object[]} drift
 * @param {boolean} json
 */
function showDrift(drift, json) {
  if (json) {
    console.log(JSON.stringify(drift, null, 2));
    return;
  }
  const fixable = drift.filter(d => d.fixable);
  console.log(
    `${drift.length} ${drift.length === 1 ? 'task has' : 'tasks have'} dates that don't match ` +
    `${drift.length === 1 ? 'its' : 'their'} column:`
  );
  for (const item of drift) {
    console.log(`  ${item.task}: ${item.message}`);
  }
  if (fixable.length) {
    console.log(utility.replaceTags(
      `\nRun {b}kanbn validate --fix{b} to fill in ${fixable.length === 1 ? 'the missing date' : 'the missing dates'}.`
    ));
  }
}

/**
 * Show warnings about a multi-board workspace
 * @param {object[]} warnings
 */
function showBoardWarnings(warnings) {
  if (!warnings.length) {
    return;
  }
  console.log(
    `${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}:`
  );
  for (const warning of warnings) {
    console.log(`  ${warning.board === null ? 'workspace' : warning.board}: ${warning.message}`);
  }
}

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

  // Validate kanbn files, on this board or on every board in the workspace
  const allBoards = !!args['all-boards'];
  let result;
  try {
    result = allBoards ? await kanbn.validateAllBoards(args.save) : await kanbn.validate(args.save);
  } catch (error) {
    utility.error(error);
    return;
  }
  if (result !== true) {
    utility.error(
      `${result.length} errors found in task files:\n${(
        args.json
          ? JSON.stringify(result, null, 2)
          : yaml.stringify(result, 4, 2)
      )}`
    );
    return;
  }

  // Report multi-board problems. These are warnings rather than errors: each one describes a
  // workspace that still works, just not the way its author probably meant it to. A workspace with
  // one board has none of these problems to have, and its output is exactly what it always was
  const multiBoard = (await kanbn.listBoards()).length > 1;
  let boardWarnings = [];
  if (multiBoard) {
    try {
      boardWarnings = await kanbn.findBoardWarnings();
    } catch (error) {
      utility.error(error);
      return;
    }
  }

  // Backfill missing started and completed dates
  if (args.fix) {
    let fixed;
    try {
      fixed = await kanbn.fixDateDrift();
    } catch (error) {
      utility.error(error);
      return;
    }
    if (!fixed.length) {
      console.log('Everything OK, nothing to fix');
      return;
    }
    if (args.json) {
      console.log(JSON.stringify(fixed, null, 2));
      return;
    }
    console.log(`Filled in ${fixed.length} missing ${fixed.length === 1 ? 'date' : 'dates'}:`);
    for (const item of fixed) {
      console.log(`  ${item.task}: ${item.field} set to ${item.date.toISOString()} (from ${item.source})`);
    }
    return;
  }

  // Report tasks whose dates disagree with their column
  let drift;
  try {
    drift = await kanbn.findDateDrift();
  } catch (error) {
    utility.error(error);
    return;
  }
  if (args.json) {

    // A multi-board workspace has warnings to report as well as drift, so JSON output carries both.
    // With a single board it stays the bare drift list it has always been
    if (multiBoard) {
      console.log(JSON.stringify({ drift, warnings: boardWarnings }, null, 2));
      return;
    }
    if (drift.length) {
      showDrift(drift, true);
      return;
    }
    console.log('Everything OK');
    return;
  }
  if (drift.length) {
    showDrift(drift, false);
  }
  showBoardWarnings(boardWarnings);
  if (drift.length || boardWarnings.length) {
    return;
  }
  console.log('Everything OK');
};
