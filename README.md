# Kanbn

A CLI kanban board application.

Documentation can be found [here](./docs/index.md).

Ready-to-run example boards live in [`example`](./example) - a [basic board](./example/basic), one demonstrating [views and lanes](./example/views), and one demonstrating [advanced configuration](./example/advanced).

## Installation

```
npm install -g @basementuniverse/kanbn
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
  gantt ......... Generate and view a Gantt chart
  validate ...... Validate index and task files
  archive ....... Archive a task
  restore ....... Restore a task from the archive
  remove-all .... Remove the kanbn board and all tasks
  history ....... Show task history

For more help with commands, try:

kanbn help <command>
kanbn h <command>
kanbn <command> --help
kanbn <command> -h
```
