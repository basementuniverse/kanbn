const minimist = require('minimist');

module.exports = async () => {
  const args = minimist(process.argv.slice(2), {
    boolean: [
      'version',
      'help',
      'interactive',
      'force'
    ],
    string: [
      'title',
      'description',
      'column'
    ],
    alias: {
      'version': ['v'],
      'help': ['h'],
      'interactive': ['n'],
      'title': ['t'],
      'description': ['d'],
      'column': ['c'],
      'untracked': ['u'],
      'force': ['f']
    }
  });

  // Get first command
  let command = args._[0] || '';

  // Check for shortcut arguments
  if (args.init || command === 'i') {
    command = 'init';
  }
  if (args.add || command === 'a') {
    command = 'add';
  }
  if (args.edit || command === 'e') {
    command = 'edit';
  }
  if (args.remove || command === 'rm') {
    command = 'remove';
  }
  if (args.move || command === 'mv') {
    command = 'move';
  }
  if (args.find || command === 'f') {
    command = 'find';
  }
  if (args.status || command === 's') {
    command = 'status';
  }
  if (args.burndown || command === 'b') {
    command = 'burndown';
  }
  if (args.nuclear) {
    command = 'nuclear';
  }
  if (args.version || command === 'v') {
    command = 'version';
  }
  if (args.help || command === 'h') {
    command = 'help';
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
      await require('./commands/init')(args);
      break;
    case 'add':
      await require('./commands/add')(args);
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
    case 'status':
      require('./commands/status')(args);
      break;
    case 'burndown':
      require('./commands/burndown')(args);
      break;
    case 'nuclear':
      await require('./commands/nuclear')(args);
      break;
    case '':
      require('./app/main.js')();
      break;
    default:
      console.error(`"${command}" is not a valid command!`);
      break;
  }
};
