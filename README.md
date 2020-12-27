# KANBN

A CLI kanban application.

## Installation

```
npm install -g git+https://github.com/basementuniverse/kanbn.git
```

## Usage

```
Usage:
  kanbn ......... Show help menu
  kanbn <command> [options]

Where <command> is one of:
  help .......... Show help menu
  version ....... Show package version
  init .......... Initialise kanbn board
  board ......... Show the kanbn board
  task .......... Show a kanbn task
  add ........... Add a kanbn task
  edit .......... Edit a kanbn task
  rename ........ Rename a kanbn task
  move .......... Move a kanbn task to another column
  comment ....... Add a comment to a task
  remove ........ Remove a kanbn task
  find .......... Search for kanbn tasks
  status ........ Get project and task statistics
  sort .......... Sort a column in the index
  sprint ........ Start a new sprint
  burndown ...... View a burndown chart
  validate ...... Validate index and task files
  remove-all .... Remove the kanbn board and all tasks

For more help with commands, try:

kanbn help <command>
kanbn h <command>
kanbn <command> --help
kanbn <command> -h
```

See [/docs](./docs/index.md) for more detailed documentation.
