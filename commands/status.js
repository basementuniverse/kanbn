const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const Spinner = require('cli-spinner').Spinner;

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get status
  const spinner = new Spinner('Creating task...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .status(args.quiet)
  .then(output => {
    spinner.stop(true);
    console.log(output);
  })
  .catch(error => {
    spinner.stop(true);
    utility.showError(error);
  });
};
