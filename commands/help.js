const utility = require('../lib/utility');

const menus = {
  main: `
Usage:
  {b}kanbn{b} {d}.........{d} Open interactive kanbn board
  {b}kanbn <command> [options]{b}

Where {b}<command>{b} is one of:
  {b}help{b} {d}..........{d} Show help menu
  {b}version{b} {d}.......{d} Show package version
  {b}init{b} {d}..........{d} Initialise kanbn board
  {b}add{b} {d}...........{d} Add a kanbn task
  {b}edit{b} {d}..........{d} Edit a kanbn task
  {b}rename{b} {d}........{d} Rename a kanbn task
  {b}remove{b} {d}........{d} Remove a kanbn task
  {b}move{b} {d}..........{d} Move a kanbn task to another column
  {b}find{b} {d}..........{d} Search for kanbn tasks
  {b}status{b} {d}........{d} Get project and task statistics
  {b}validate{b} {d}......{d} Validate index and task files
  {b}cache{b} {d}.........{d} Update the cache file
  {b}nuclear{b} {d}.......{d} Remove the kanbn board and all tasks

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

Initialise a kanbn board in the current working directory.

Options:
  {b}kanbn init --interactive{b}
  {b}kanbn init -i{b}
    Initialise a kanbn board interactively.

  {b}kanbn init --name "name"{b}
  {b}kanbn init -n "name"{b}
    Initialise a kanbn board with the specified name.

  {b}kanbn init --description "description"{b}
  {b}kanbn init -d "description"{b}
    Initialise a kanbn board with the specified description.

  {b}kanbn init --column "column"{b}
  {b}kanbn init -c "column"{b}
    Initialise a kanbn board and add the specified column. This option can be repeated to add multiple columns.
`,

  add: `
{b}kanbn add{b}
{b}kanbn a{b}

Create a new task and add it to the index.

Options:
  {b}kanbn add --interactive{b}
  {b}kanbn add -i{b}
    Create a new task or add untracked tasks interactively.

  {b}kanbn add --name "name"{b}
  {b}kanbn add --n "name"{b}
    Create a new task with the specified name. This option is required if not adding a task interactively.

  {b}kanbn add --description "description"{b}
  {b}kanbn add -d "description"{b}
    Create a new task with the specified description.

  {b}kanbn add --column "column"{b}
  {b}kanbn add -c "column"{b}
    Create a new task and add it to the specified column in the index. If this is not specified, the task will be added to the first available column.

  {b}kanbn add --due "date"{b}
  {b}kanbn add -e "date"{b}
    Create a new task and set the due date. The date can be in (almost) any format.

  {b}kanbn add --sub-task "sub-task"{b}
  {b}kanbn add -s "sub-task"{b}
    Create a new task with a sub-task. The sub-task text can be prefixed with "[ ] " or "[x] " to set the completion status.

  {b}kanbn add --tag "tag"{b}
  {b}kanbn add -t "tag"{b}
    Create a new task with a tag.

  {b}kanbn add --relation "relation"{b}
  {b}kanbn add -r "relation"{b}
    Create a new task with a relation. The relation should be an existing task id, optionally prefixed with a relation type.
    Examples:
      "blocks my-task-1"
      "duplicates my-task-2"

  {b}kanbn add --untracked{b}
  {b}kanbn add -u{b}
    Find all untracked tasks and add them to the index. If a column name is not specified, the tasks will be added to the first column.

  {b}kanbn add --untracked "filename"{b}
  {b}kanbn add -u "filename"{b}
    Add untracked tasks in the specified file(s) to the the index. This option can be repeated to add multiple files.

Examples:
  {b}kanbn a -n "My Task #1" -c "Todo" -s "[x] My sub-task" -t "Tag 1" -t "Tag 2" -r "duplicates my-task-2"{b}
    Creates a task with id "my-task-1" in column "Todo" with a completed sub-task, 2 tags, and a "duplicates" relation to "my-task-2".

  {b}kanbn a -ui -f "my-task-3" -f "my-task-4" -c "Done"{b}
    Interactively adds untracked tasks "my-task-3.md" and "my-task-4.md" to the "Done" column.
`,

  edit: `
{b}kanbn edit "task-id"{b}
{b}kanbn e "task-id"{b}

Edit an existing task and set its 'updated' date. This command can be used to rename and move tasks as well.

Options:
  {b}kanbn edit "task-id" --interactive{b}
  {b}kanbn edit "task-id" -i{b}
    Edit a task interactively.

  {b}kanbn edit "task-id" --name "name"{b}
  {b}kanbn edit "task-id" -n "name"{b}
    Modify a task name.

  {b}kanbn add --description "description"{b}
  {b}kanbn add -d "description"{b}
    Modify a task description.

  {b}kanbn edit "task-id" --column "column"{b}
  {b}kanbn edit "task-id" -c "column"{b}
    Move a task to a different column.

  {b}kanbn edit --due "date"{b}
  {b}kanbn edit -e "date"{b}
    Modify a task due date. The date can be in (almost) any format.

  {b}kanbn edit --remove-sub-task "sub-task"{b}
    Remove a sub-task.

  {b}kanbn edit --sub-task "sub-task"{b}
  {b}kanbn edit -s "sub-task"{b}
    Add or modify a sub-task. The sub-task text can be prefixed with "[ ] " or "[x] " to set the completion status.

  {b}kanbn edit --remove-tag "tag"{b}
    Remove a tag.

  {b}kanbn edit --tag "tag"{b}
  {b}kanbn edit -t "tag"{b}
    Add a tag.

  {b}kanbn edit --remove-relation "relation"{b}
    Remove a relation.

  {b}kanbn edit --relation "relation"{b}
  {b}kanbn edit -r "relation"{b}
    Add or modify a relation. The relation should be an existing task id, optionally prefixed with a relation type.
    Examples:
      "blocks my-task-1"
      "duplicates my-task-2"
`,

  rename: `
{b}kanbn rename "task-id"{b}
{b}kanbn ren "task-id"{b}

Rename a task. This will change the task filename and update the index. The task 'updated' date will also be set.

Options:
  {b}kanbn rename "task-id" --interactive{b}
  {b}kanbn rename "task-id" -i{b}
    Rename a task interactively.

  {b}kanbn rename "task-id" --name "name"{b}
  {b}kanbn rename "task-id" -n "name"{b}
    Rename the task with the specified name. This option is required if not renaming a task interactively.
`,

  remove: `
{b}kanbn remove "task-id"{b}
{b}kanbn rm "task-id"{b}

Remove an existing task.

Options:
  {b}kanbn remove "task-id" --index{b}
    Only remove the task from the index. The task file will not be deleted.

  {b}kanbn remove "task-id" --force{b}
  {b}kanbn remove "task-id" -f{b}
    Force remove the task without asking for confirmation.
`,

  move: `
{b}kanbn move "task-id"{b}
{b}kanbn mv "task-id"{b}

Move an existing task to a different column in the index. The task 'updated' date will also be set.

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

Only tasks that match all of the filters will be returned.

If search terms are surrounded by "/" (e.g. "/search term/"), they will be treated as regular expressions.

Options:
  {b}kanbn find --quiet{b}
  {b}kanbn find -q{b}
    Only show task ids in the output.

  {b}kanbn find --name "search term"{b}
  {b}kanbn find -n "search term"{b}
    Find tasks that have a name containing "search term".

  {b}kanbn find --description "search term"{b}
  {b}kanbn find -d "search term"{b}
    Find tasks that have a description containing "search term".

  {b}kanbn find --column "column"{b}
  {b}kanbn find -c "column"{b}
    Find tasks that are in a specific column. This option can be repeated to find tasks in any one of multiple columns.

  {b}kanbn find --created "date"{b}
    Find tasks that were created on a specific date. The time part of the date will be ignored, unless searching between multiple dates.
    This option can be repeated - if multiple dates are specified, find tasks that were created between the earliest and latest dates.
    The date can be in (almost) any format.

  {b}kanbn find --updated "date"{b}
    Find tasks that were updated on a specific date. The time part of the date will be ignored, unless searching between multiple dates.
    This option can be repeated - if multiple dates are specified, find tasks that were updated between the earliest and latest dates.
    The date can be in (almost) any format.

  {b}kanbn find --completed "date"{b}
    Find tasks that have a completed date that matches the specified date. The time part of the date will be ignored, unless searching between multiple dates.
    This option can be repeated - if multiple dates are specified, find tasks that were completed between the earliest and latest dates.
    The date can be in (almost) any format.

  {b}kanbn find --due "date"{b}
  {b}kanbn find -e "date"{b}
    Find tasks that are due on a specific date. The time part of the date will be ignored, unless searching between multiple dates.
    This option can be repeated - if multiple dates are specified, find tasks that are due between the earliest and latest dates.
    The date can be in (almost) any format.

  {b}kanbn find --sub-task "search term"{b}
  {b}kanbn find -s "search term"{b}
    Find tasks that have sub-tasks matching the search term.

  {b}kanbn find --tag "search term"{b}
  {b}kanbn find -t "search term"{b}
    Find tasks that have tags matching the search term.

  {b}kanbn find --relation "search term"{b}
  {b}kanbn find -r "search term"{b}
    Find tasks that have relations matching the search term.
`,

  status: `
{b}kanbn status{b}
{b}kanbn s{b}

Show status information for the current project. // TODO status help documentation needs more information

Options:
  {b}kanbn status --quiet{b}
  {b}kanbn status -q{b}
    Only show a count of tasks in each column, without loading and caching all tracked tasks.

  {b}kanbn status --json{b}
  {b}kanbn status -j{b}
    Output status information in JSON format.
`,

  validate: `
{b}kanbn validate{b}

Validate kanbn index file and all task files, and report any formatting errors.
`,

  cache: `
{b}kanbn cache{b}

Update the cache file if one is configured in the index options.
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

module.exports = args => {
  const subCommand = (args._[0] === 'help' || args._[0] === 'h')
    ? args._[1]
    : args._[0];

  console.log(utility.replaceTags(menus[subCommand] || menus.main).trim());
};
