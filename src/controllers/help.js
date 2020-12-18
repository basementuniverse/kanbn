const fs = require('fs');
const path = require('path');
const utility = require('../utility');

module.exports = async (args, argv, routeId) => {
  const helpRoute = require(path.join(__dirname, '../../routes', `${routeId}.json`));
  fs.promises.readFile(path.join(__dirname, '../../', helpRoute.help), { encoding: 'utf-8' }).then(help => {
    console.log(utility.replaceTags(help).trim());
  });
};
