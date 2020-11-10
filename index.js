const minimist = require('minimist');

module.exports = () => {
  const args = minimist(process.argv.slice(2));

  // Get first command
  let command = args._[0] || '';

  // Check for shortcut arguments
  if (args.version || args.v) {
    command = 'version';
  }
  if (args.help || args.h) {
    command = 'help';
  }
  if (args.init || args.i) {
    command = 'init';
  }
  if (args.add || args.a) {
    command = 'add';
  }
  if (args.edit || args.e) {
    command = 'edit';
  }
  if (args.remove || args.rm) {
    command = 'remove';
  }
  if (args.move || args.mv) {
    command = 'move';
  }
  if (args.find || args.f) {
    command = 'find';
  }
  if (args.stats || args.s) {
    command = 'stats';
  }
  if (args.burndown || args.b) {
    command = 'burndown';
  }
  if (args.nuclear) {
    command = 'nuclear';
  }

  // Run command
  switch (command) {
    case 'version':
      require('./commands/version')(args);
      break;
    case 'help':
      require('./commands/help')(args);
      break;
    case 'init':
      require('./commands/init')(args);
      break;
    case 'add':
      require('./commands/add')(args);
      break;
    case 'edit':
      require('./commands/edit')(args);
      break;
    case 'remove':
      require('./commands/remove')(args);
      break;
    case 'move':
      require('./commands/move')(args);
      break;
    case 'find':
      require('./commands/find')(args);
      break;
    case 'stats':
      require('./commands/stats')(args);
      break;
    case 'burndown':
      require('./commands/burndown')(args);
      break;
    case 'nuclear':
      require('./commands/nuclear')(args);
      break;
    case '':
      require('./app/main.js')();
      break;
    default:
      console.error(`"${command}" is not a valid command!`);
      break;
  }
};
