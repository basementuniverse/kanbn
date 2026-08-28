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
 * Show lines in columns that aren't task links. These are preserved and ignored, so this is
 * information rather than a problem - except for a line that looks like a task link with a typo in
 * it, which is the one way a task can silently stop being tracked
 * @param {object[]} warnings
 */
function showColumnContentWarnings(warnings) {
  if (!warnings.length) {
    return;
  }
  const malformed = warnings.filter(w => w.type === 'malformed-task-link');
  const untracked = warnings.filter(w => w.type === 'untracked-task-line');
  const other = warnings.filter(w => w.type === 'non-task-line');
  if (malformed.length) {
    console.log(utility.replaceTags(
      `${malformed.length} ${malformed.length === 1 ? 'line looks' : 'lines look'} like a ` +
      `{b}malformed task link{b} and ${malformed.length === 1 ? 'is' : 'are'} not being tracked:`
    ));
    for (const warning of malformed) {
      console.log(`  ${warning.column}: ${warning.text}`);
    }
  }
  if (untracked.length) {
    console.log(utility.replaceTags(
      `${untracked.length} ${untracked.length === 1 ? 'line names' : 'lines name'} a task file that ` +
      `exists but ${untracked.length === 1 ? 'is' : 'are'} {b}not written as a link{b}, so ` +
      `${untracked.length === 1 ? 'it isn\'t' : 'they aren\'t'} tracked:`
    ));
    for (const warning of untracked) {
      console.log(`  ${warning.column}: ${warning.text}`);
    }
  }
  if (other.length) {
    console.log(
      other.length === 1
        ? "1 line in a column isn't a task link (preserved, but ignored):"
        : `${other.length} lines in columns aren't task links (preserved, but ignored):`
    );
    for (const warning of other) {
      console.log(`  ${warning.column}: ${warning.text}`);
    }
  }
}

/**
 * Show tasks whose assigned user or comment author isn't a known contributor. These are advisory:
 * contributors are a convenience list, not an enum, and every one of these tasks works exactly as it
 * always has
 * @param {object[]} warnings
 */
function showContributorWarnings(warnings) {
  if (!warnings.length) {
    return;
  }

  // One line per name rather than per task, because "Gordon appears in 12 tasks" is the useful shape
  const byValue = new Map();
  for (const warning of warnings) {
    if (!byValue.has(warning.value)) {
      byValue.set(warning.value, []);
    }
    byValue.get(warning.value).push(warning.task);
  }
  console.log(utility.replaceTags(
    `${byValue.size} ${byValue.size === 1 ? 'name is' : 'names are'} used in tasks but ` +
    `${byValue.size === 1 ? "isn't" : "aren't"} a {b}known contributor{b}:`
  ));
  for (const [value, tasks] of byValue) {
    console.log(`  ${value}: ${tasks.join(', ')}`);
  }
  console.log(utility.replaceTags('Run {b}kanbn contributors --usage{b} for more detail.'));
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

  // Report lines in columns that aren't task links. Unlike the warnings above these apply to any
  // workspace, so they're gathered whether or not it has more than one board
  let columnContentWarnings = [];
  try {
    columnContentWarnings = await kanbn.findColumnContentWarnings();
  } catch (error) {
    utility.error(error);
    return;
  }

  // Report names used in tasks that the contributors list doesn't know about. A workspace with no
  // contributors declared has none of these, so its output is exactly what it always was
  let contributorWarnings = [];
  try {
    contributorWarnings = await kanbn.findContributorWarnings();
  } catch (error) {
    utility.error(error);
    return;
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
      if (!args.json && (columnContentWarnings.length || contributorWarnings.length)) {
        showColumnContentWarnings(columnContentWarnings);
        showContributorWarnings(contributorWarnings);
        return;
      }
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
    // With a single board it stays the bare drift list it has always been - unless there are
    // warnings, which have nowhere to go in a bare drift list and are worth more than the shape
    const warnings = [...boardWarnings, ...columnContentWarnings, ...contributorWarnings];
    if (multiBoard || warnings.length) {
      console.log(JSON.stringify({ drift, warnings }, null, 2));
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
  showColumnContentWarnings(columnContentWarnings);
  showContributorWarnings(contributorWarnings);
  showBoardWarnings(boardWarnings);
  if (drift.length || boardWarnings.length || columnContentWarnings.length || contributorWarnings.length) {
    return;
  }
  console.log('Everything OK');
};
