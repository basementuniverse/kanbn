const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const Spinner = require('cli-spinner').Spinner;

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Validate kanbn files
  const spinner = new Spinner('Validating index and task files...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn.validate(args.save)
  .then(result => {
    spinner.stop(true);
    if (result === true) {
      console.log('Everything ok');
    } else {
      console.error(`${result.length} errors found in task files:\n${result.join('\n')}`);
    }
  })
  .catch(error => {
    spinner.stop(true);
    utility.showError(error);
  });
};
