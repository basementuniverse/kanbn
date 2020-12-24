# KANBN

## Features

* The kanban board and tasks live inside your repo
* Task files are markdown, so they are easy to read and edit in your IDE

## Getting Started

### Initialise a Kanbn board in your project

```
kanbn init
```

This will create a `.kanbn/` folder with an index (`.kanbn/index.md`) and a folder for tasks (`.kanbn/tasks/`)

See [init](init.md) for more information on initialising kanbn.

### Start adding tasks

```
kanbn add -n "My new task"
```

This will create a task file `.kanbn/tasks/my-new-task.md`.

See [add](add.md) for more information on creating tasks.

### View the kanbn board

```
kanbn board
```

This will show a kanbn board, something like this:

```
╭────────────────────────┬─────────────────────────┬────────────────────────╮
│Todo                    │» In Progress            │✓ Done                  │
├────────────────────────┼─────────────────────────┼────────────────────────┤
│Task 1                  │Task 8                   │Task 5                  │
│27 Nov 20, 19:35        │29 Nov 20, 19:35         │29 Nov 20, 19:35        │
│                        │                         │                        │
│Task 9                  │Task 3                   │Task 4                  │
│29 Nov 20, 19:35        │28 Nov 20, 19:35         │29 Nov 20, 19:35        │
│                        │                         │                        │
│Task 15                 │                         │Task 6                  │
│12 Dec 20, 22:00        │                         │29 Nov 20, 18:41        │
│                        │                         │                        │
│Task 2                  │                         │                        │
│29 Nov 20, 19:35        │                         │                        │
╰────────────────────────┴─────────────────────────┴────────────────────────╯
```

## Commands

* [help](help.md) Show help menu
* [version](version.md) Show package version
* [init](init.md) Initialise kanbn board
* [board](board.md) Show the kanbn board
* [task](task.md) Show a kanbn task
* [add](add.md) Add a kanbn task
* [edit](edit.md) Edit a kanbn task
* [rename](rename.md) Rename a kanbn task
* [move](move.md) Move a kanbn task to another column
* [comment](comment.md) Add a comment to a task
* [remove](remove.md) Remove a kanbn task
* [find](find.md) Search for kanbn tasks
* [status](status.md) Get project and task statistics
* [sort](sort.md) Sort a column in the index
* [sprint](sprint.md) Start a new sprint
* [burndown](burndown.md) View a burndown chart
* [validate](validate.md) Validate index and task files
* [nuclear](nuclear.md) Remove the kanbn board and all tasks
