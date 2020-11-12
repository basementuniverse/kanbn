const kanbn = require('../lib/main');
const inquirer = require('inquirer');

module.exports = async (args) => {
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
      console.log(error);
    })
  }
};
