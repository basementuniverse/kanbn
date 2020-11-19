const minimist = require('minimist');
const path = require('path');

module.exports = async () => {
  require('dotenv').config({ path: path.join(__dirname, '.env') });

  // Parse arguments
  const args = minimist(process.argv.slice(2), {
    boolean: [
      'version',
      'help',
      'interactive',
      'force',
      'index',
      'quiet',
      'json'
    ],
    string: [
      'title',
      'description',
      'column',
      'filter',
      'due',
      'sub-task',
      'remove-sub-task',
      'tag',
      'remove-tag',
      'relation',
      'remove-relation'
    ],
    alias: {
      'version': ['v'],
      'help': ['h'],
      'interactive': ['n'],
      'title': ['t'],
      'description': ['d'],
      'column': ['c'],
      'untracked': ['u'],
      'force': ['f'],
      'index': ['i'],
      'quiet': ['q'],
      'filter': ['s'],
      'json': ['j'],
      'due': ['e'],
      'sub-task': ['b'],
      'tag': ['g'],
      'relation': ['r']
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
  if (args.rename || command === 'ren') {
    command = 'rename';
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
      await require('./commands/edit')(args);
      break;
    case 'rename':
      await require('./commands/rename')(args);
      break;
    case 'remove':
      await require('./commands/remove')(args);
      break;
    case 'move':
      await require('./commands/move')(args);
      break;
    case 'find':
      await require('./commands/find')(args);
      break;
    case 'status':
      await require('./commands/status')(args);
      break;
    case 'nuclear':
      await require('./commands/nuclear')(args);
      break;
    case '':
      require('./app/main.js')();
      break;
    default:
      console.error(`"${command}" is not a valid command`);
      break;
  }
};
