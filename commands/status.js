const kanbn = require('../src/main');
const utility = require('../src/utility');
const Spinner = require('cli-spinner').Spinner;
const chrono = require('chrono-node');

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get sprint number or name
  let sprint = null;
  if (args.sprint) {
    sprint = utility.argToString(args.sprint);
    const sprintNumber = parseInt(sprint);
    if (!isNaN(sprintNumber)) {
      sprint = sprintNumber;
    }
  }

  // Re-use the description arg for dates
  let dates = [...args.date || [], ...args.d || []].flat();
  if (dates.length) {
    for (let i = 0; i < dates.length; i++) {
      const dateValue = chrono.parseDate(dates[i]);
      if (dateValue === null) {
        utility.error('Unable to parse date', true);
      }
      dates[i] = dateValue;
    }
  } else {
    dates = null;
  }

  // Get status
  const spinner = new Spinner('Getting status information...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .status(
    args.quiet,
    args.json,
    args.untracked,
    args.due !== undefined,
    sprint,
    dates
  )
  .then(output => {
    spinner.stop(true);
    console.log(output);
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
};
