# Kanbn Task Reference

This reference describes the structure expected for task files in `.kanbn/tasks/`.

## Minimum Valid Shape

```markdown
# Define authentication flow

Describe the scope of the task, the decisions to make, and the expected output.

## Sub-tasks

- [ ] Review requirements
- [ ] Document the proposed flow

## Relations

- [depends-on gather-auth-requirements](gather-auth-requirements.md)
```

## With Metadata

```markdown
---
tags:
  - Auth
  - Planning
due: 2026-08-01T00:00:00.000Z
---

# Define authentication flow

Describe the scope of the task, the constraints, and the deliverable.

## Sub-tasks

- [ ] Map user journeys
- [ ] Compare session and token approaches
- [ ] Document recommendation

## Relations

- [depends-on gather-auth-requirements](gather-auth-requirements.md)
- [blocks design-login-ui](design-login-ui.md)
```

## Rules

- File name: `<task-id>.md`
- File path: `.kanbn/tasks/<task-id>.md`
- The first level-1 heading is the task name.
- Content below the title is the task description.
- Reserved level-2 headings are:
  - `Metadata`
  - `Sub-tasks`
  - `Relations`
  - `Comments`
  - `History`

Other headings are allowed inside the description, but use them sparingly.

## Description Guidance

Good task descriptions usually cover:

- what needs to be planned, decided, designed, or documented
- what is explicitly in scope
- what is out of scope when that boundary matters
- what output should exist when the task is complete

Useful patterns:

```markdown
# Plan deployment strategy

Define how the application will be deployed across environments.

## Deliverables

- Deployment approach for development, staging, and production
- Rollback approach
- Infrastructure assumptions

## Acceptance Criteria

- Target environments are named
- Release path is documented
- Rollback constraints are captured
```

## Metadata Guidance

Prefer omission over invention.

Usually omit:

- `created`
- `updated`
- `started`
- `completed`
- `progress`
- `assigned`
- `comments`
- `history`

Add metadata only when the user supplied it or when the board already relies on it.

Good uses of metadata:

- `tags` for epics, teams, domains, or sizing labels
- `due` for explicit deadlines
- custom fields already defined by the existing board

## Relations Guidance

Relation entries use markdown links.

Examples:

```markdown
## Relations

- [depends-on plan-data-model](plan-data-model.md)
- [blocks define-api-contract](define-api-contract.md)
- [duplicates old-auth-plan](old-auth-plan.md)
```

Semantics:

- `depends-on X`: this task waits for `X`
- `blocks X`: this task is a prerequisite for `X`
- `duplicates` and similar non-dependency relations are informational only

Do not add both `depends-on X` and the mirrored inverse on the same task unless the user wants that phrasing explicitly.

## Common Mistakes

- Mismatching the file name and referenced task id.
- Using plain text instead of a markdown link in `## Relations`.
- Inventing timestamps, progress, or comments.
- Writing a task name that is too broad to act on.
- Creating a relation to a task file that does not exist.
