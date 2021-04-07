# Index Structure

Here is a sample index file (`.kanbn/index.md`):

```markdown
# Project Name

Project description...

## Options

``yaml
optionName: optionValue
``

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

The project options heading should be followed by a code block containing YAML. The 'yaml' info-string is not required, but might help with syntax highlighting in some editors.

## Project options

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
    lanes:
      - name: "Lane 1"
        filter:
          - field: name
            filter: ""
metadataProperties:
  - name: 'started'
    type: 'date'
```

### `hiddenColumns`

A list of column names. These columns will be hidden from the kanbn board.

// TODO finish index options...
