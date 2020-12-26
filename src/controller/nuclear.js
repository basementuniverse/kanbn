const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

/**
 * Nuke kanbn
 */
function nuclear() {
  kanbn.nuclear()
  .then(() => {
    console.log('kanbn has been removed');
  })
  .catch(error => {
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
