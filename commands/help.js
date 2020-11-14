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
  {b}rename{b} {d}........{d} rename a kanbn task
  {b}remove{b} {d}........{d} remove a kanbn task
  {b}move{b} {d}..........{d} move a kanbn task to another column
  {b}find{b} {d}..........{d} search for kanbn tasks
  {b}status{b} {d}........{d} get project and task statistics
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
    Add untracked tasks in the specified file(s) to the first column in the index. This argument can be repeated to add multiple files.

  {b}kanbn add --untracked --column "column"{b}
  {b}kanbn add -u -c "column"{b}
    Find all untracked tasks and add them to the specified column in the index.

  {b}kanbn add --untracked "filename" --column "column"{b}
  {b}kanbn add -u "filename" -c "column"{b}
    Add untracked tasks in the specified file(s) to the specified column in the index. This argument can be repeated to add multiple files.
`,

  edit: `
{b}kanbn edit "task-id"{b}
{b}kanbn e "task-id"{b}

Edit an existing task and update its 'updated' date.

Options:
  {b}kanbn edit "task-id" --interactive{b}
  {b}kanbn edit "task-id" -n{b}
    Edit a task interactively.
`,

  rename: `
{b}kanbn rename "task-id"{b}
{b}kanbn ren "task-id"{b}

Rename a task. This will change the task filename and update the index.

Options:
  {b}kanbn rename "task-id" --interactive{b}
  {b}kanbn rename "task-id" -n{b}
    Rename a task interactively.

  {b}kanbn rename "task-id" --title "title"{b}
  {b}kanbn rename "task-id" -t "title"{b}
    Rename the task with the specified title. This option is required if not renaming a task interactively.
`,

  remove: `
{b}kanbn remove "task-id"{b}
{b}kanbn rm "task-id"{b}

Remove an existing task.

Options:
  {b}kanbn remove "task-id" --index{b}
  {b}kanbn remove "task-id" -i{b}
    Only remove the task from the index. The task file will not be deleted.

  {b}kanbn remove "task-id" --force{b}
  {b}kanbn remove "task-id" -f{b}
    Force remove the task without asking for confirmation.
`,

  move: `
{b}kanbn move "task-id"{b}
{b}kanbn mv "task-id"{b}

Move an existing task to a different column in the index.

Options:
  {b}kanbn move "task-id" --interactive{b}
  {b}kanbn move "task-id" -n{b}
    Move a task interactively.

  {b}kanbn move "task-id" --column "column"{b}
  {b}kanbn move "task-id" -c "column"{b}
    Move the task to this column in the index. This option is required if not moving a task interactively.
`,

  find: `
{b}kanbn find{b}
{b}kanbn f{b}

Search all tasks in the index and show search results. If no filters are specified, this command will list all tracked tasks.

Options:
  {b}kanbn find --quiet{b}
  {b}kanbn find -q{b}
    Only show task ids in the output.

  {b}kanbn find --filter "filter"{b}
  {b}kanbn find -s "filter"{b}
    Add a search filter. This argument can be repeated to add multiple filters. See below for filter syntax.

Filter syntax:
  ... // TODO add filter syntax documentation
`,

  status: `
{b}kanbn status{b}
{b}kanbn s{b}

Show status information for the current project... // TODO add more information about status command

Options:
  {b}kanbn status --json{b}
  {b}kanbn status -j{b}
    Output status information in JSON format.
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

module.exports = (args) => {
  const subCommand = (args._[0] === 'help' || args._[0] === 'h')
    ? args._[1]
    : args._[0];

  console.log(utility.replaceTags(menus[subCommand] || menus.main).trim());
};
