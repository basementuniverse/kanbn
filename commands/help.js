const utility = require('../lib/utility');

const menus = {
  help: `
Usage:
  {b}kanbn{b} {d}.........{d} Open interactive kanbn board
  {b}kanbn <command> [options]{b}

Where {b}<command>{b} is one of:
  {b}help{b} {d}..........{d} Show help menu
  {b}version{b} {d}.......{d} Show package version
  {b}init{b} {d}..........{d} Initialise kanbn board
  {b}board{b} {d}.........{d} Show the kanbn board
  {b}add{b} {d}...........{d} Add a kanbn task
  {b}edit{b} {d}..........{d} Edit a kanbn task
  {b}rename{b} {d}........{d} Rename a kanbn task
  {b}move{b} {d}..........{d} Move a kanbn task to another column
  {b}remove{b} {d}........{d} Remove a kanbn task
  {b}find{b} {d}..........{d} Search for kanbn tasks
  {b}status{b} {d}........{d} Get project and task statistics
  {b}sort{b} {d}..........{d} Sort a column in the index
  {b}sprint{b} {d}........{d} Start a new sprint
  {b}validate{b} {d}......{d} Validate index and task files
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

  board: `
{b}kanbn board{b}
{b}kanbn b{b}

Show the kanbn board.
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

  {b}kanbn edit --description "description"{b}
  {b}kanbn edit -d "description"{b}
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

  find: `
{b}kanbn find{b}
{b}kanbn f{b}

Search all tasks in the index and show search results. If no filters are specified, this command will list all tracked tasks.

Search terms are treated as case-insensitive regular expressions.

Only tasks that match all of the filters will be returned.

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

  {b}kanbn find --started "date"{b}
    Find tasks that have a started date that matches the specified date. The time part of the date will be ignored, unless searching between multiple dates.
    This option can be repeated - if multiple dates are specified, find tasks that were started between the earliest and latest dates.
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

  {b}kanbn find --count-sub-tasks N{b}
    Find tasks that have a specific number of sub-tasks.
    If multiple counts are specified, find tasks with a number of sub-tasks between the lowest and highest inputs.

  {b}kanbn find --tag "search term"{b}
  {b}kanbn find -t "search term"{b}
    Find tasks that have tags matching the search term.

  {b}kanbn find --count-tags N{b}
    Find tasks that have a specific number of tags.
    If multiple counts are specified, find tasks with a number of tags between the lowest and highest inputs.

  {b}kanbn find --relation "search term"{b}
  {b}kanbn find -r "search term"{b}
    Find tasks that have relations matching the search term.

  {b}kanbn find --count-relations N{b}
    Find tasks that have a specific number of relations.
    If multiple counts are specified, find tasks with a number of relations between the lowest and highest inputs.
`,

  status: `
{b}kanbn status{b}
{b}kanbn s{b}

Show status information for the current project.

Options:
  {b}kanbn status --quiet{b}
  {b}kanbn status -q{b}
    Only show a count of tasks in each column, without loading all tracked tasks.
    If used with the --untracked option, only show a list of untracked task filenames.

  {b}kanbn status --json{b}
  {b}kanbn status -j{b}
    Output status information in JSON format.

  {b}kanbn status --untracked{b}
  {b}kanbn status -u{b}
    Show a list of untracked task filenames.

  {b}kanbn status --sprint N|"name"{b}
  {b}kanbn status -p N|"name"{b}
    Show sprint workload for a specific sprint.
    The sprint can be selected by number or name.
    This option will be ignored if the --quiet option is set or if no sprint options are defined in the index.

  {b}kanbn status --date "date"{b}
  {b}kanbn status -d "date"{b}
    Show created/started/completed workload for a specific date. The time part of the date will be ignored, unless searching between multiple dates.
    This option can be repeated - if multiple dates are specified, show created/started/completed workload for tasks created/started/completed between the earliest and latest dates.
    The date can be in (almost) any format.
    This option will be ignored if the --quiet or --sprint options are set.
`,

  sort: `
{b}kanbn sort "column"{b}

Sort a column in the index. The "column" value is optional if sorting a column interactively.

Some task attributes can be optionally transformed using case-insensitive regular expressions.
If a filter is specified, the matched text will be used when sorting.

If the filter regular expression has numbered capturing groups, the value of the first group will be used.
If the filter regular expression has named capturing groups, the value of all named groups will be concatenated.
If there are multiple matches, their values will be concatenated.

Options:
  {b}kanbn sort --interactive{b}
  {b}kanbn sort -i{b}
    Sort a column interactively.

  {b}kanbn sort --save{b}
    Save the column sort settings in the index file. This means that any tasks added to the column will be automatically sorted.
    If this option is not set, any saved sorting settings for the specified column will be removed.

  {b}kanbn sort --ascending{b}
  {b}kanbn sort -a{b}
    Sort the column in ascending order. This is the default order. This option can be set after each sorting field. If this option is set before any sorting fields, all fields will be sorted in ascending order.

  {b}kanbn sort --descending{b}
  {b}kanbn sort -z{b}
    Sort the column in descending order instead of default ascending order. This option can be set after each sorting field. If this option is set before any sorting fields, all fields will be sorted in descending order.

  {b}kanbn sort --id "filter"{b}
    Sort tasks by id.

  {b}kanbn sort --name "filter"{b}
  {b}kanbn sort -n "filter"{b}
    Sort tasks by name.

  {b}kanbn sort --description "filter"{b}
  {b}kanbn sort -d "filter"{b}
    Sort tasks by description.

  {b}kanbn sort --created{b}
    Sort tasks by created date.

  {b}kanbn sort --updated{b}
    Sort tasks by updated date.

  {b}kanbn sort --started{b}
    Sort tasks by started date.

  {b}kanbn sort --completed{b}
    Sort tasks by completed date.

  {b}kanbn sort --due{b}
    Sort tasks by due date.

  {b}kanbn sort --sub-task "filter"{b}
  {b}kanbn sort -s "filter"{b}
    Sort tasks by sub-tasks.

  {b}kanbn sort --count-sub-tasks{b}
    Sort tasks by the number of sub-tasks.

  {b}kanbn sort --tag "filter"{b}
  {b}kanbn sort -t "filter"{b}
    Sort tasks by tags.

  {b}kanbn sort --count-tags{b}
    Sort tasks by the number of tags.

  {b}kanbn sort --relation "filter"{b}
  {b}kanbn sort -r "filter"{b}
    Sort tasks by relations.

  {b}kanbn sort --count-relations{b}
    Sort tasks by the number of relations.

  {b}kanbn sort --workload{b}
  {b}kanbn sort -w{b}
    Sort tasks by workload.

Examples:
  {b}kanbn sort "Todo" --created -z -n "Task (\\d+)" -w{b}
    Sort tasks in the "Todo" column first by created date in descending order, then by their name (filtered such that only numeric characters after the string "Task " are used) in ascending order, then by workload in ascending order

  {b}kanbn sort "Todo" -z -n --count-tags{b}
    Sort tasks in the "Todo" column first by name, then by the number of tags, all in descending order
`,

  sprint: `
{b}kanbn sprint{b}
{b}kanbn sp{b}

Start a new sprint.

Options:
  {b}kanbn sprint --interactive{b}
  {b}kanbn sprint -i{b}
    Start a new sprint interactively.

  {b}kanbn sprint --name "name"{b}
  {b}kanbn sprint -n "name"{b}
    Start a new sprint with the specified name.

  {b}kanbn sprint --description "description"{b}
  {b}kanbn sprint -d "description"{b}
    Start a new sprint with the specified description.
`,

  validate: `
{b}kanbn validate{b}

Validate kanbn index file and all task files, and report any formatting errors.

Options:
  {b}kanbn validate --save{b}
    Re-save the index and task files. This will ensure that all index column sorting settings are applied and that all tasks are formatted correctly.
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

  console.log(utility.replaceTags(menus[subCommand] || menus.help).trim());
};
