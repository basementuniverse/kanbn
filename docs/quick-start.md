# Quick Start

## Initialise a Kanbn board in your project

```
cd my-project-folder
kanbn init
```

This will create a `.kanbn/` folder containing an index file (`.kanbn/index.md`) and a folder for tasks (`.kanbn/tasks/`).

Run `kanbn init --help` for more information on initialising kanbn.

## Start adding tasks

```
kanbn add -n "My new task"
```

This will create a task file `.kanbn/tasks/my-new-task.md`.

Run `kanbn add --help` for more information on creating tasks.

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

This will add a "Large" tag to the task and modify the task's updated date. If you're using the default settings, this will also affect the task's workload.

Run `kanbn edit --help` for more information on editing tasks.

## Find tasks

```
kanbn find --tag "Large" --column "Todo"
```

Filters are combined with AND, string filters are case-insensitive regular expressions, and dates and numbers can be given twice to search a range. See [filtering and sorting](filtering-and-sorting.md) for the full model.

## Customise the board

Define a view in your project options to re-arrange, filter or group the board without moving any tasks:

```yaml
views:
  - name: 'by-assignee'
    lanes:
      - name: 'Me'
        filters:
          assigned: '^my-username$'
      - name: 'Everyone else'
        filters:
          assigned: '^(?!my-username$).*'
```

```
kanbn board -v by-assignee
```

See [views](views.md) for columns, lanes, filters and sorters.

## Next steps

- [Index structure](index-structure.md) — project settings, tags and workload calculations
- [Task structure](task-structure.md) — task metadata, sub-tasks, relations and comments
- [Views](views.md) and [filtering and sorting](filtering-and-sorting.md)
- [Advanced configuration](advanced-configuration.md) — separate config files and custom paths
- The [`example`](../example) directory contains three ready-to-run boards you can experiment with
