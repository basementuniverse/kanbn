const kanbn = require('../lib/main');
const inquirer = require('inquirer');
const utility = require('../lib/utility');

module.exports = async (args) => {
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  if (args.force) {
    await kanbn.nuclear();
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
