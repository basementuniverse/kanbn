const fs = require('fs');
const path = require('path');
const utility = require('../utility');

module.exports = async args => {
  const command = ((args._[0] === 'help' || args._[0] === 'h') ? args._[1] : args._[0]) || 'help';
  const commandRoute = require(path.join(__dirname, '../../routes/', `${command}.json`));
  fs.promises.readFile(path.join(__dirname, '../../', commandRoute.help), { encoding: 'utf-8' }).then(help => {
    console.log(utility.replaceTags(help).trim());
  });
};
