const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');

module.exports = async (args) => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // If the force flag is specified, remove kanbn without asking
  if (args.force) {
    await kanbn.nuclear();

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
        await kanbn.nuclear();
      }
    }).catch(error => {
      utility.showError(error);
    })
  }
};
