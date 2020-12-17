const minimist = require('minimist');
const path = require('path');
const utility = require('./src/utility');

module.exports = async () => {
  require('dotenv').config({ path: path.join(__dirname, '.env') });

  // Get the command
  const command = process.argv[2] || '';

  // Load all route configs
  const routes = require('auto-load')(path.join(__dirname, 'routes'));

  // Check for help argument and identify route
  const args = minimist(process.argv.slice(2), {
    boolean: [
      'help'
    ],
    alias: {
      help: ['h']
    }
  });
  const route = args.help ? routes.help : Object.values(routes).find(r => r.commands.indexOf(command) !== -1);

  // Make sure the command is valid
  if (route === undefined) {
    utility.error(`"${command}" is not a valid command`, true);
  }

  // Parse arguments again using route-specific options and pass to the relevant controller
  await require(route.controller)(
    minimist(
      process.argv.slice(2),
      route.args
    ),
    process.argv
  );
};
