# Index Structure

Here is a sample index file (`.kanbn/index.md`):

```markdown
---
optionName: optionValue
---

# Project Name

Project description...

## Column 1

- [task-1](tasks/task-1.md)

## Column 2

- [task-2](tasks/task-2.md)
- [task-3](tasks/task-3.md)
```

The index file can optionally begin with YAML front-matter containing project options.

There should be a single level-1 heading at the top of the markdown body containing the project name.

The project description should appear below the title. The description can be of any length and can contain markdown, however it must not contain any level-2 headings. Deeper headings (level 3 and below) are fine, as are level-2 headings inside a fenced code block.

Below the description there should be one or more level-2 headings. The 'Options' name is reserved for project options.

All level-2 headings (except for 'Options') will be treated as columns.

## Column contents

A column tracks a task when it contains a **markdown link** to that task's file:

```markdown
## Todo

- [my-task](tasks/my-task.md)
```

That link is the only thing kanbn reads as a task. Any other line in a column - a bare title, a checkbox item, a note, a paragraph - is left exactly as you wrote it and ignored by every command:

```markdown
## Todo

- [my-task](tasks/my-task.md)
- remember to check the staging deploy
- [ ] buy milk
```

These lines are **simple tasks**. They have no id, no metadata and no dates, they can't collide with a task of the same name, and they count towards nothing: not `kanbn status`, not workload, burndown, gantt or sprints. They are preserved when kanbn saves the board file, and stay in the column they were written in - though a line isn't anchored to the task above it, so sorting a column can move tasks around it.

They are shown on the board in the default layout, dimmed, at the end of their column. Views leave them out: a view filters and sorts tasks, and a simple task has no fields to filter or sort on. They are left out of `kanbn board --json` for the same reason.

### Working with simple tasks

Four commands accept a simple task, addressed by its title - exactly, ignoring case, or slugified, so `"Buy milk"` and `buy-milk` both work. **A real task always wins**: kanbn only looks for a simple task when no task has that id, so a line whose title matches an existing task can only be edited by hand.

| Command | Effect |
| --- | --- |
| `kanbn move "Buy milk" -c Done` | Moves the line to another column. `-b` moves it to another board |
| `kanbn edit "Buy milk" ...` | **Promotes** it to a real task file, then edits it as normal |
| `kanbn remove "Buy milk"` | Deletes the line. There is no file to delete and nothing to archive |
| `kanbn task "Buy milk"` | Says which column it's in, and how to promote it |

Promotion is one-way. The new task gets a file, an id, a `created` date as of the promotion and a `created` history event naming the column the line was in. There is no way back: a task carries metadata, comments and history that a line can't hold.

Two lines with the same title on one board are two different lines, so a command naming one of them reports the ambiguity rather than guessing. Two lines with the same title on *different* boards are unrelated - a simple task belongs to the board file it's written in, and nothing else.

Anything that isn't a single line of a list - a paragraph, a quote, a code block - is preserved just the same, but isn't a simple task: it isn't shown on the board, and no command will move, promote or remove it.

`kanbn validate` lists them, so they can't hide. It reports two cases more loudly, because both mean a task silently isn't being tracked:

- a line that looks like a task link with a typo in it, e.g. a missing closing bracket;
- a line naming a task file that exists but isn't written as a link, e.g. `- my-task`.

_Note: before version 2.2.0 a bare task id in a column (`- my-task`) was treated as a task reference. It no longer is - only links are. Run `kanbn validate` to find any, and write them as links._

If a column references a task file that doesn't exist, kanbn skips that task and carries on rather than failing - this happens routinely when a board file and a task file arrive in different commits. `kanbn board` says how many tasks were skipped, and `kanbn validate` names them.

## Project options

The 'Options' heading should be followed by a code block containing YAML. The 'yaml' info-string is not required, but might help with syntax highlighting in some editors.

Project options will be merged with YAML front-matter if any is present.

_Note: when the index is saved, all project options will be placed into YAML front-matter. The 'Options' heading is still supported for backwards-compatibility._

```yaml
hiddenColumns:
  - Archive
startedColumns:
  - In Progress
completedColumns:
  - Done
sprints:
  - start: date
    name: name
    description: ""
defaultTaskWorkload: 2
taskWorkloadTags:
  Nothing: 0
  Tiny: 1
  Small: 2
  Medium: 3
  Large: 5
  Huge: 8
columnSorting:
  Archive:
    - field: name
      filter: ""
      order: ascending
taskTemplate: ""
dateFormat: ""
views:
  - name: My view 1
    filters:
      tag: Bug
    columns:
      - name: Column 1
        filters:
          name: test
          workload:
            - 1
            - 5
        sorters:
          - field: name
            filter: ""
            order: ascending
    lanes:
      - name: Lane 1
        filters:
          assigned: username
customFields:
  - name: 'myCustomField'
    type: 'date'
{customFieldName}Columns:
  - {Column name}
contributors:
  - gordon
  - name: dave
    displayName: Dave Smith
    email: dave@example.com
    aliases:
      - Dave Smith
    colour: '#7c5cff'
actions:
  - name: start-work
    on: task.moved
    when:
      toColumn: In Progress
    then:
      - assign: '@me'
      - addTag: active
actionsFile: ""
```

### `hiddenColumns`

A list of column names. These columns will be hidden from the kanbn board.

This only affects the default board layout. Tasks in hidden columns are still tracked, still show up in `kanbn find` and `kanbn status`, and are still shown by any [view](views.md) that defines its own `columns`.

### `startedColumns`

A list of column names. When a task is created in or dragged into one of these columns, the task's `started` date will be set to the current time, unless the task already has a 'started' date.

### `completedColumns`

A list of column names. When a task is created in or dragged into one of these columns, the task's `completed` date will be set to the current time, unless the task already has a `completed` date.

Note that these columns control when the date is _written_. They don't decide whether a task counts as complete - that comes from the date itself. See [Task state](#task-state) below.

### `startedField`

The name of the metadata field that holds a task's started date. Defaults to `started`.

### `completedField`

The name of the metadata field that holds a task's completed date. Defaults to `completed`.

Pointing these at custom date fields lets a board track its own started/completed state without touching the shared `started` and `completed` fields:

```yaml
completedField: designSignedOffAt
completedColumns:
  - Signed Off
customFields:
  - name: designSignedOffAt
    type: date
```

### `verbose`

Set to `false` to suppress hints and notices printed alongside normal output, such as the reminder shown when tasks have dates that don't match their column. Defaults to `true`. Hints are never shown when using `--json`.

### `defaultBoard`

The board that commands target when `-b` isn't given and `KANBN_BOARD` isn't set. Workspace-scoped: it belongs in the config file, or in the main board's front matter when there is no config file.

See [multiple boards](multiple-boards.md).

### `boards`

Board discovery settings. `exclude` lists markdown files in the kanbn folder that aren't boards, `order` sets the display order for `kanbn boards`, and any other key is a board slug whose value is that board's options.

```yaml
boards:
  exclude:
    - notes.md
  order:
    - index
    - design
  design:
    hiddenColumns:
      - Ideas
```

Workspace-scoped. See [multiple boards](multiple-boards.md).

### `sprints`

A list of sprints. Each sprint will have `start`, `name` and `description` properties. See [sprints](sprints.md).

A board can declare its own `sprints` in its front matter, which **replaces** the workspace list for that board entirely. See [multiple boards](multiple-boards.md#per-board-sprints).

Run `kanbn sprint --help` for more information.

### `defaultTaskWorkload`

The default workload amount for tasks. When a task has no workload tags applied to it, this value will be used instead.

### `taskWorkloadTags`

An associative array of tag names and workload values. If these tags are added to a task, their values will be used to calculate the task workload. Multiple workload tags can be added to a task, in which case their values will be summed.

### `columnSorting`

An associative array of column names and sorters. Each column can have an array of sorters, where each sorter should have `field`, `filter` and `order` properties.

The `filter` property can be used to transform values before sorting.

Columns listed here are re-sorted every time Kanbn writes the index, so the order survives `kanbn add`, `kanbn move` and `kanbn validate --save`.

See [Filtering and Sorting](filtering-and-sorting.md#sorters), or run `kanbn sort --help`.

### `taskTemplate`

A [template literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) used for rendering tasks on the kanbn board. The following variables can be interpolated into the string:

```
name
description
created
updated
started
completed
due
assigned
tags
subTasks
relations
overdue
dueDelta
dueMessage
column
workload
progress
{...customFields}
```

_Note: referencing a variable that isn't in the list above (or a custom field that isn't declared in `customFields`) will print "Unable to build task template" instead of rendering the board._

The default task template is `^+^_${overdue ? '^R' : ''}${name}^: ${created ? ('\\n^-^/' + created) : ''}`.

This string can contain markup sequences. See [terminal-kit](https://github.com/cronvel/terminal-kit/blob/21607fb51749853dd9193c6aaf205b14c63b2768/doc/markup.md#markup) for markup reference.

_Note: custom fields can also be interpolated into the task template, but only if they are defined in `customFields` (see below)._

### `dateFormat`

The date format to use for dates on the kanbn board and burndown chart views. See [dateformat](https://www.npmjs.com/package/dateformat) for date format reference.

### `views`

An array of views that can be used to customize how the kanbn board is displayed. Select a view with `kanbn board --view "name"`.

Each view has a required `name`, an optional root `filters` object, an optional array of `columns` and an optional array of `lanes`. Each column has a required `name` and optional `filters` and `sorters`. Each lane has a required `name` and optional `filters`.

If `columns` is omitted, the index columns are used (minus `hiddenColumns`). If `lanes` is omitted, a single lane containing all matching tasks is used.

See [Views](views.md) for a full description and worked examples, and [Filtering and Sorting](filtering-and-sorting.md) for the filter and sorter formats.

### `customFields`

An array of custom metadata fields, where each field should have `name` and `type` properties. Adding a custom field to this list allows you to reference the field when adding, updating, searching and sorting tasks.

Run `kanbn add --help`, `kanbn edit --help`, `kanbn find --help` and `kanbn sort --help` for more information.

Valid types are:

- `boolean`
- `date`
- `number`
- `string`

Additionally, if a custom field has type `date`, the custom field can have a string property called `updateDate`. See the `{customFieldName}Columns` section for information on how this property is used.

### `{customFieldName}Columns`

A list of column names. `{customFieldName}` should be the name of a custom field with type `date` (see the `customFields` section above for more information).

When a task is created in or dragged into one of these columns, the matching custom field in the task can be set to the current time.

If the custom field has `updateDate` set to `once`, the field will only be updated if it doesn't already have a value.

If the custom field has `updateDate` set to `always`, the field will be updated every time the task is moved into a linked column.

Here's an example of how this could be used:

- Assume we have added a column called `Testing`
- In `index.md` (or `kanbn.json` / `kanbn.yml` if using a separate configuration file), we have:
  ```
  customFields:
    - name: testedAt
      type: date
      updateDate: once
  testedAtColumns:
    - Testing
  ```
- When a task is moved into the `Testing` column and the task doesn't already have a `testedAt` value in its metadata, this value will be automatically populated with the current date/time.

### `contributors`

An optional list of the people who work on this workspace. Each entry is either a bare name or an object with a required `name` and optional `displayName`, `email`, `aliases` and `colour`.

`contributors` is **workspace-scoped**: like `customFields`, it belongs in `kanbn.json` / `kanbn.yml`, or in the main board's front matter when there is no configuration file, and every board inherits it. A secondary board that declares its own is reported by `kanbn validate` and ignored.

Contributors are **advisory**. `assigned` and comment `author` remain free text and are never validated against the list, never rejected and never rewritten. What the list buys you is a canonical spelling for each person, an autocomplete in the interactive prompts, `@me` in filters, and `kanbn contributors --usage` to find the spellings already in use.

See [Contributors](contributors.md) for the full description, and `kanbn contributors --help`.

### `actions`

A list of rules that fire when a task is created, moved, updated, commented on, archived, restored, deleted, started or completed. Each rule names an event (`on`), an optional condition (`when`), an optional set of related tasks to act on (`for`), and the verbs to apply (`then`).

```yaml
actions:
  - name: start-work
    on: task.moved
    when:
      toColumn: In Progress
    then:
      - assign: '@me'
      - addTag: active
      - removeTag: ready
```

`actions` is board-scoped: in a configuration file it applies to every board, and in a board's front matter it applies to that board alone. A board that declares its own replaces the inherited list rather than adding to it.

Rules only fire during commands that change something, and nothing a rule writes ever fires another rule. See [Actions](actions.md) for the events, the verbs, the substitutions and the failure semantics.

### `actionsFile`

A path, relative to the `.kanbn` folder, of a file holding the same list of rules that `actions` would have held. For rule sets that have outgrown a board's front matter.

```yaml
actionsFile: actions/design.yml
```

Setting both `actions` and `actionsFile` on the same board is an error, and so is naming a file that doesn't exist or doesn't parse.

## Task state

Whether a task has started or been completed is decided by its metadata dates, and nothing else:

- a task has started if its `started` field is set (or whichever field `startedField` names);
- a task is complete if its `completed` field is set (or whichever field `completedField` names).

The column a task sits in doesn't make it started or complete. Columns listed in `startedColumns` and `completedColumns` cause those dates to be _written_ when a task is moved through the CLI or the VSCode extension, but the dates are what everything else reads: `kanbn status`, `kanbn find`, progress, burndown charts and gantt charts.

This matters when a task is moved **outside** of kanbn - by editing the index file by hand, or through a git merge. No date is written in that case, so the task keeps whatever state its metadata already described. `kanbn validate` reports tasks whose dates and columns disagree, and `kanbn validate --fix` fills in the missing dates, taking them from the task's history where possible.

To clear a date - for example to reopen a task that was completed - use `kanbn edit "task-id" --unset completed`.

_Note: before version 2.0.0, a task sitting in a completed column counted as complete even with no `completed` date. See [Migrating to 2.0.0](migration-2.0.md)._
