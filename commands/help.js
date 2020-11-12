const utility = require('../lib/utility');

const menus = {
  main: `
Usage:
  {b}kanbn{b} {d}.........{d} open interactive kanbn board
  {b}kanbn <command> [options]{b}

Where {b}<command>{b} is one of:
  {b}help{b} {d}..........{d} show help menu
  {b}version{b} {d}.......{d} show package version
  {b}init{b} {d}..........{d} initialise kanbn board
  {b}add{b} {d}...........{d} add a kanbn task
  {b}edit{b} {d}..........{d} edit a kanbn task
  {b}remove{b} {d}........{d} remove a kanbn task
  {b}move{b} {d}..........{d} move a kanbn task to another column
  {b}find{b} {d}..........{d} search for kanbn tasks
  {b}status{b} {d}........{d} get task statistics
  {b}burndown{b} {d}......{d} view a burndown chart
  {b}nuclear{b} {d}.......{d} remove the kanbn board and all tasks

For more help with commands, try:

{b}kanbn help <command>{b}
{b}kanbn h <command>{b}
{b}kanbn <command> --help{b}
{b}kanbn <command> -h{b}
`,

  version: `
{b}kanbn version{b}
{b}kanbn v{b}
{b}kanbn --version{b}
{b}kanbn -v{b}

Show package version.
`,

  init: `
{b}kanbn init{b}
{b}kanbn i{b}

Initialise a kanbn board in the current working directory using the default options.

Options:
  {b}kanbn init --interactive{b}
  {b}kanbn init -n{b}
    Initialise a kanbn board interactively.

  {b}kanbn init --title "title"{b}
  {b}kanbn init -t "title"{b}
    Initialise a kanbn board with the specified title.

  {b}kanbn init --description "description"{b}
  {b}kanbn init -d "description"{b}
    Initialise a kanbn board with the specified description.
`,

  add: `
{b}kanbn add{b}
{b}kanbn a{b}

Create a new task and add it to the index.

Options:
  {b}kanbn add --interactive{b}
  {b}kanbn add -n{b}
    Create a new task interactively.

  {b}kanbn add --title "title"{b}
  {b}kanbn add --t "title"{b}
    Create a new task with the specified title. This option is required if not adding a task interactively.

  {b}kanbn add --column "column"{b}
  {b}kanbn add -c "column"{b}
    Create a new task and add it to the specified column in the index. If this is not specified, the task will be added to the first available column.

  {b}kanbn add --untracked{b}
  {b}kanbn add -u{b}
    Find all untracked tasks and add them to the first column in the index.

  {b}kanbn add --untracked "filename"{b}
  {b}kanbn add -u "filename"{b}
    Add untracked tasks in the specified file(s) to the first column in the index. The {b}--untracked{b} / {b}-u{b} argument can be repeated to add multiple files.

  {b}kanbn add --untracked --column "column"{b}
  {b}kanbn add -u -c "column"{b}
    Find all untracked tasks and add them to the specified column in the index.

  {b}kanbn add --untracked "filename" --column "column"{b}
  {b}kanbn add -u "filename" -c "column"{b}
    Add untracked tasks in the specified file(s) to the specified column in the index.  The {b}--untracked{b} / {b}-u{b} argument can be repeated to add multiple files.
`,

  edit: `

`,

  remove: `

`,

  move: `

`,

  find: `

`,

  stats: `

`,

  burndown: `

`,

  nuclear: `
{b}kanbn nuclear{b}

This is the nuclear option. It completely removes your '.kanbn' directory and all of the contents.

Make sure you have anything that you want to keep committed or backed-up before running this.

Options:
  {b}kanbn nuclear -f{b}
    Force delete without asking for confirmation.
`
};

// TODO finish help

module.exports = (args) => {
  const subCommand = (args._[0] === 'help' || args._[0] === 'h')
    ? args._[1]
    : args._[0];

  console.log(utility.replaceTags(menus[subCommand] || menus.main).trim());
};
