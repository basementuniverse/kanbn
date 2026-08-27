# Task Structure

Here is a sample task file (`.kanbn/tasks/task-name.md`):

```markdown
---
created: 2021-03-18T02:08:42.293Z
updated: 2021-03-18T02:08:42.293Z
tags:
  - TagName
assigned: Username
progress: 0.5
started: 2021-03-21T04:58:38.653Z
completed: 2021-03-21T04:58:38.653Z
due: 2021-03-21T04:58:38.653Z
plannedStart: 2021-03-20T04:58:38.653Z
plannedFinish: 2021-03-24T04:58:38.653Z
---

# Task Name

Task description...

## Sub-tasks

- [ ] This is an incomplete sub-task
- [x] This sub-task has been completed

## Relations

- [duplicates test-task-1](test-task-1.md)
- [obsoletes test-task-2](test-task-2.md)

## Comments

- author: Username
  date: 2021-03-31T07:47:05.775Z
  This is a comment...

## History

- type: created
  date: 2021-03-18T02:08:42.293Z
  column: Backlog
- type: moved
  date: 2021-03-21T04:58:38.653Z
  fromColumn: Backlog
  toColumn: In Progress
- type: progress
  date: 2021-03-22T09:30:00.000Z
  fromProgress: 0.25
  toProgress: 0.5
- type: archived
  date: 2021-03-31T07:47:05.775Z
  fromColumn: In Progress
- type: restored
  date: 2021-04-01T10:00:00.000Z
  toColumn: Backlog
```

The task file can optionally begin with YAML front-matter containing task metadata.

There should be a single level-1 heading at the top of the markdown body containing the task name.

The task description should appear below the title. The description can be of any length and can contain markdown.

The following level-2 headings are reserved for special purposes (`## Metadata`, `## Sub-tasks`, `## Relations`, `## Comments` and `## History`). Any other level-2 heading is treated as part of the description.

## Metadata

The 'Metadata' heading should be followed by a code block containing YAML. The 'yaml' info-string is not required, but might help with syntax highlighting in some editors.

Task metadata will be merged with YAML front-matter if any is present.

*Note: when a task is saved, all task metadata will be placed into YAML front-matter. The 'Metadata' heading is still supported for backwards-compatibility.*

```yaml
created: 2021-03-18T02:08:42.293Z
updated: 2021-03-18T02:08:42.293Z
tags:
  - TagName
assigned: Username
progress: 0.5
started: 2021-03-21T04:58:38.653Z
completed: 2021-03-21T04:58:38.653Z
due: 2021-03-21T04:58:38.653Z
```

### `created`

The date and time that the task was created. This is automatically populated when the task is created using `kanbn add`.

### `updated`

The date and time that the task was last updated. This is automatically populated when the task is modified, renamed, or moved to another column.

### `tags`

An array of tags to apply to this task.

### `assigned`

The name of the user this task is assigned to.

### `progress`

The amount of progress for this task. This should be between 0 (not started) and 1 (complete).

Progress is not derived from sub-tasks. If the task has no `progress` value it counts as 0, and a task that is considered complete always counts as 1 regardless of this value. A task is considered complete if its [`completedField`](index-structure.md#completedfield) — `completed` by default — has a date. The column a task sits in doesn't make it complete; see [Index Structure](index-structure.md#completedcolumns).

### `started`

The date and time that the task was started.

### `completed`

The date and time that the task was completed.

### `due`

The date and time that the task is due to be completed.

### `plannedStart`

An optional date and time used as a preferred start point for gantt scheduling.

### `plannedFinish`

An optional date and time used as a preferred finish point for gantt scheduling.

### Custom fields

Any other metadata field is preserved but otherwise ignored, unless it is declared in the [`customFields`](index-structure.md#customfields) project option. Declared custom fields can be set with `kanbn add` and `kanbn edit`, searched with `kanbn find`, sorted with `kanbn sort`, filtered in [views](views.md), and interpolated into the board's [`taskTemplate`](index-structure.md#tasktemplate).

### Workload

A task's workload is not stored in the file - it is calculated from the task's `tags`. It is the sum of the values of its [workload tags](index-structure.md#taskworkloadtags), or `defaultTaskWorkload` if it has none.

## Sub-tasks

This should be a list of strings. Each string can optionally start with `[ ]` (incomplete) or `[x]` (completed).

## Relations

This should be a list of links to other task files. The link text can optionally begin with a relation type.

The `depends-on` relation type is reserved for gantt scheduling. It means the current task should not start until the linked task has finished.

## Comments

An array of comments, where each comment has an `author` and `date` property, and some text.

## History

An optional array of structured lifecycle events used for richer timeline reporting (including burndown).

Supported event types:

- `created`: requires `date` and `column`
- `added`: requires `date` and `column` — the task joined a board
- `removed`: requires `date` — the task left a board
- `moved`: requires `date`, `fromColumn`, `toColumn`
- `progress`: requires `date`, `fromProgress`, `toProgress`
- `archived`: requires `date`, `fromColumn`
- `restored`: requires `date`, `toColumn`

Notes:

- History entries are stored in the reserved `## History` section as list items.
- `date` should be an ISO timestamp.
- Additional fields (for example `author`) are preserved if present.
- An event type this version of Kanbn doesn't recognise is preserved and skipped rather than rejected, so a task file written by a newer version stays readable.

### Board attribution

In a workspace with [multiple boards](multiple-boards.md), an event carries an optional `board` key naming the board it happened on:

```markdown
## History

- type: moved
  date: 2026-07-14T09:12:00.000Z
  fromColumn: Ideas
  toColumn: Designing
  board: design
```

Events on the **main board carry no `board` key**, so a single-board workspace writes exactly the history it always has, and every existing task file stays valid.

`archived` and `progress` events are never board-scoped: archiving removes a task from every board, and progress is a property of the task rather than of a board.
