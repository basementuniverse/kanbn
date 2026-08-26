const kanbn = require('../main');
const utility = require('../utility');
const yaml = require('yamljs');

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

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }

  // Validate kanbn files
  let result;
  try {
    result = await kanbn.validate(args.save);
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
  if (drift.length) {
    showDrift(drift, args.json);
    return;
  }
  console.log('Everything OK');
};
