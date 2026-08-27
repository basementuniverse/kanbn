const workspace = require('../main');
const utility = require('../utility');
const chrono = require('chrono-node');
const yaml = require('yamljs');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

  // Get sprint number or name
  let sprint = null;
  if (args.sprint) {
    sprint = utility.strArg(args.sprint);
    const sprintNumber = parseInt(sprint);
    if (!isNaN(sprintNumber)) {
      sprint = sprintNumber;
    }
  }

  // Get filter dates
  let dates = null;
  if (args.date) {
    dates = utility.arrayArg(args.date);
    if (dates.length) {
      for (let i = 0; i < dates.length; i++) {
        const dateValue = chrono.parseDate(dates[i]);
        if (dateValue === null) {
          utility.error('Unable to parse date');
          return;
        }
        dates[i] = dateValue;
      }
    }
  }

  // Get status
  kanbn
  .status(
    args.quiet,
    args.untracked,
    args.due,
    sprint,
    dates
  )
  .then(output => {
    if (args.quiet && args.untracked && !args.json) {
      console.log(
        output.length
          ? output.join('\n')
          : 'No untracked tasks found'
      );
    } else {
      console.log(args.json ? JSON.stringify(output, null, 2) : yaml.stringify(output, 4, 2));
    }
  })
  .then(async () => {

    // Only load tasks for the hint when it would actually be shown
    if (args.json || args.quiet) {
      return;
    }
    const index = await kanbn.getIndex();
    if (!kanbn.isVerbose(index)) {
      return;
    }
    utility.showDateDriftHint(await kanbn.findDateDrift());
  })
  .catch(error => {
    utility.error(error);
  });
};
