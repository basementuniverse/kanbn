const minimist = require('minimist');
const path = require('path');
const utility = require('./src/utility');

module.exports = async () => {
  require('dotenv').config({ path: path.join(__dirname, '.env') });

  // Get the command
  const command = process.argv[2] || '';

  // Load route configs and get the current route
  const routes = require('auto-load')(path.join(__dirname, 'routes')), route = {};
  const found = Object.entries(routes).find(([id, route]) => route.commands.indexOf(command) !== -1);

  // Make sure we have a valid route
  if (found === undefined) {
    utility.error(`"${command}" is not a valid command`);
    return;
  }
  ({ 0: route.id, 1: route.config } = found);

  // Check for help argument and override route if present
  const args = minimist(process.argv.slice(2), {
    boolean: ['help'],
    alias: { help: ['h'] }
  });
  if (route.id === 'help' || args.help) {
    const helpCommand = (c => args._.filter(arg => c.indexOf(arg) !== -1).pop() || 'help')(
      [...Object.values(routes).map(r => r.commands)].flat()
    );
    route.id = Object.keys(routes).find(k => routes[k].commands.indexOf(helpCommand) !== -1);
    route.config = routes.help;
  }

  // Parse arguments again using route-specific options and pass to the relevant controller
  await require(route.config.controller)(
    minimist(
      process.argv.slice(2),
      route.config.args
    ),
    process.argv,
    route.id
  );
};
