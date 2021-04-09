# Index Structure

Here is a sample index file (`.kanbn/index.md`):

```markdown
# Project Name

Project description...

## Options

\```yaml
optionName: optionValue
\```

## Column 1

- [task-1](tasks/task-1.md)

## Column 2

- [task-2](tasks/task-2.md)
- [task-3](tasks/task-3.md)
```

There should be a level-1 heading at the top containing the project name.

The project description should appear below the title. The description can be of any length and can contain markdown, however it cannot contain any headings.

Below the description there should be one or more level-2 headings. The 'Options' name is reserved for project options.

All level-2 headings (except for 'Options') will be treated as columns. Columns should only contain a list of links to task markdown files.

## Project options

The 'Options' heading should be followed by a code block containing YAML. The 'yaml' info-string is not required, but might help with syntax highlighting in some editors.

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
    columns:
      "Column 1":
        - hidden: false
          filters:
            name: /test/
            workload:
              - 1
              - 5
          sorters:
            - field: name
              filter: ""
              order: ascending
    lanes:
      - name: "Lane 1"
        filter:
          - field: name
            filter: ""
customFields:
  - name: 'myCustomField'
    type: 'date'
```

### `hiddenColumns`

A list of column names. These columns will be hidden from the kanbn board.

### `startedColumns`

A list of column names. When a task is created in or dragged into one of these columns, the task's `started` date will be set to the current time, unless the task already has a 'started' date.

### `completedColumns`

A list of column names. When a task is created in or dragged into one of these columns, the task's `completed` date will be set to the current time. If the task already has a `completed` date, this date will be updated.

### `sprints`

A list of sprints. Each sprint will have `start`, `name` and `description` properties.

Run `kanbn sprint --help` for more information.

### `defaultTaskWorkload`

The default workload amount for tasks. When a task has no workload tags applied to it, this value will be used instead.

### `taskWorkloadTags`

An associative array of tag names and workload values. If these tags are added to a task, their values will be used to calculate the task workload. Multiple workload tags can be added to a task, in which case their values will be summed.

### `columnSorting`

An associative array of column names and sorters. Each column can have an array of sorters, where each sorter should have `field`, `filter` and `order` properties.

The `filter` property can be used to transform values before sorting.

Run `kanbn sort --help` for more information.

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
tags
subTasks
relations
overdue
dueDelta
dueMessage
column
workload
progress
```

The default task template is `^+^_${overdue ? '^R' : ''}${name}^: ${created ? ('\\n^-^/' + created) : ''}`.

This string can contain markup sequences. See [terminal-kit](https://github.com/cronvel/terminal-kit/blob/21607fb51749853dd9193c6aaf205b14c63b2768/doc/markup.md#markup) for markup reference.

### `dateFormat`

The date format to use for dates on the kanbn board and burndown chart views. See [dateformat](https://www.npmjs.com/package/dateformat) for date format reference.

### `views`

An array of views that can be used to customize how the kanbn board is displayed.

Each view should have a `name` property (run `kanbn board --view "name"` to specify which view to use), a list of columns and a list of lanes.

Each column can be hidden, filtered or sorted. Each lane has a list of filters.

### `customFields`

An array of custom metadata fields, where each field should have `name` and `type` properties. Adding a custom field to this list allows you to reference the field when adding, updating, searching and sorting tasks.

Run `kanbn add --help`, `kanbn edit --help`, `kanbn find --help` and `kanbn sort --help` for more information.

Valid types are:
- `boolean`
- `date`
- `number`
- `string`
