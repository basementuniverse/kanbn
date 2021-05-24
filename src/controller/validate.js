const kanbn = require('../main');
const utility = require('../utility');
const yaml = require('yamljs');

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }

  // Validate kanbn files
  kanbn.validate(args.save)
  .then(result => {
    if (result === true) {
      console.log('Everything OK');
    } else {
      utility.error(
        `${result.length} errors found in task files:\n${(
          args.json
            ? JSON.stringify(result, null, 2)
            : yaml.stringify(result, 4, 2)
        )}`
      );
    }
  })
  .catch(error => {
    utility.error(error);
  });
};
