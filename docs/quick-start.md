# Quick Start

## Initialise a Kanbn board in your project

```
cd my-project-folder
kanbn init
```

This will create a `.kanbn/` folder containing an index file (`.kanbn/index.md`) and a folder for tasks (`.kanbn/tasks/`).

See [init](init.md) for more information on initialising kanbn.

## Start adding tasks

```
kanbn add -n "My new task"
```

This will create a task file `.kanbn/tasks/my-new-task.md`.

See [add](add.md) for more information on creating tasks.

## View the kanbn board

```
kanbn board
```

This will show a kanbn board, something like this:

```
╭────────────────────────┬─────────────────────────┬────────────────────────╮
│Todo                    │» In Progress            │✓ Done                  │
├────────────────────────┼─────────────────────────┼────────────────────────┤
│All tasks               │                         │                        │
├────────────────────────┼─────────────────────────┼────────────────────────┤
│Notifications           │Database schema          │Initialise framework    │
│27 Nov 20, 12:39        │25 Nov 20, 16:08         │21 Nov 20, 19:35        │
│                        │                         │                        │
│Add entity timestamps   │Basic entities           │User auth               │
│25 Nov 20, 11:42        │25 Nov 20, 16:09         │23 Nov 20, 15:29        │
│                        │                         │                        │
│Implement entity UUIDs  │                         │Groups and permissions  │
│26 Nov 20, 22:00        │                         │23 Nov 20, 18:41        │
│                        │                         │                        │
│My new task             │                         │                        │
│26 Nov 20, 19:31        │                         │                        │
╰────────────────────────┴─────────────────────────┴────────────────────────╯
```

## Edit a task

```
kanbn edit "my-new-task" -t "Large"
```

This will add a "Huge" tag to the task and modify the task's updated date. If you're using the default settings, this will also affect the task's workload.

See [edit](edit.md) for more information on editing tasks.

See [index structure](index-structure.md) for more information on project settings, tags and workload calculations.
