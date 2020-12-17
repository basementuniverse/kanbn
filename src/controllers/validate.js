const kanbn = require('../main');
const utility = require('../utility');
const Spinner = require('cli-spinner').Spinner;
const yaml = require('yamljs');

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Validate kanbn files
  const spinner = new Spinner('Validating index and task files...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn.validate(args.save)
  .then(result => {
    spinner.stop(true);
    if (result === true) {
      console.log('Everything OK');
    } else {
      utility.error(
        `${result.length} errors found in task files:\n${(
          args.json
            ? JSON.stringify(result, null, 2)
            : yaml.stringify(result, 4, 2)
        )}`,
        true
      );
    }
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
};
