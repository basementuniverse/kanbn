const kanbn = require('../src/main');
const utility = require('../src/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

/**
 * Nuke kanbn
 */
function nuclear() {
  const spinner = new Spinner('Removing kanbn...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn.nuclear()
  .then(() => {
    spinner.stop(true);
    console.log('kanbn has been removed');
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // If the force flag is specified, remove kanbn without asking
  if (args.force) {
    nuclear();

  // Otherwise, prompt for confirmation first
  } else {
    inquirer.prompt([
      {
        type: 'confirm',
        message: 'Are you sure you want to remove kanbn and all tasks?',
        name: 'sure',
        default: false
      }
    ]).then(async answers => {
      if (answers.sure) {
        nuclear();
      }
    }).catch(error => {
      utility.error(error, true);
    })
  }
};
