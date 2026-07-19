# Kanbn Index Reference

This reference describes the structure expected for `.kanbn/index.md` when generating a project plan.

## Minimum Valid Shape

```markdown
---
startedColumns:
  - In Progress
completedColumns:
  - Done
---

# Project Name

Short project summary and planning assumptions.

## Backlog

- [task-id-1](tasks/task-id-1.md)
- [task-id-2](tasks/task-id-2.md)

## Todo

- [task-id-3](tasks/task-id-3.md)

## In Progress

## Done
```

## Rules

- The file may begin with YAML front matter.
- There must be exactly one level-1 heading for the project name.
- Text under the project heading is the project description.
- After the description, each level-2 heading defines a column.
- Each column should contain a markdown list of task links.
- Each task link should point to `tasks/<task-id>.md`.
- The link text should be the task id, not the human-readable title.

## Recommended Defaults

If the user does not specify a workflow, prefer:

```yaml
startedColumns:
  - In Progress
completedColumns:
  - Done
```

And columns:

- `Backlog`
- `Todo`
- `In Progress`
- `Done`

## Placement Guidance

- Put tasks in `Todo` only if they are ready to start and not obviously blocked.
- Put blocked, later-phase, or lower-priority work in `Backlog`.
- Leave `In Progress` empty for a newly generated plan unless the prompt explicitly says work is underway.
- Leave `Done` empty unless the prompt explicitly references completed work.

## Options Worth Using

Only add options when they are meaningful.

Commonly useful options:

- `startedColumns`
- `completedColumns`
- `hiddenColumns`
- `taskWorkloadTags`
- `defaultTaskWorkload`
- `customFields`

Avoid adding large option blocks that the user did not ask for.

## Common Mistakes

- Using headings inside the project description.
- Listing bare task ids instead of markdown links.
- Linking to the wrong path, for example `./tasks/...` or absolute paths.
- Treating columns as epics or teams instead of workflow states.
- Populating `In Progress` or `Done` with speculative work states.
