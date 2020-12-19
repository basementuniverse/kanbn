const kanbn = require('../main');
const utility = require('../utility');
const Spinner = require('cli-spinner').Spinner;
const chrono = require('chrono-node');
const yaml = require('yamljs');

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

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
          utility.error('Unable to parse date', true);
        }
        dates[i] = dateValue;
      }
    }
  }

  // Get status
  const spinner = new Spinner('Getting status information...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .status(
    args.quiet,
    args.untracked,
    args.due,
    sprint,
    dates
  )
  .then(output => {
    spinner.stop(true);
    console.log(args.json ? JSON.stringify(output, null, 2) : yaml.stringify(output, 4, 2));
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
};
