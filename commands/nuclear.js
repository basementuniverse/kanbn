const kanbn = require('../lib/main');
const inquirer = require('inquirer');

module.exports = (args) => {
  if (args.f) {
    kanbn.nuclear();
  } else {
    inquirer.prompt([
      {
        type: 'confirm',
        message: 'Are you sure?',
        name: 'sure',
        default: false
      }
    ]).then(answers => {
      if (answers.sure) {
        kanbn.nuclear();
      }
    }).catch(error => {
      console.log(error);
    })
  }
};
