---
name: kanbn-plan
description: Turn a project brief into Kanbn planning artifacts only. Use this skill to generate or revise a Kanbn board index and task markdown files, including task descriptions, sub-tasks, and dependency relationships, without implementing the project itself.
---

# Kanbn Plan

Use this skill when the user wants project planning output in Kanbn format: a board, task files, dependencies, sequencing, scope breakdown, and task descriptions.

Do not use this skill to implement the project, edit source code, scaffold files outside `.kanbn/`, or estimate progress from work that has not happened yet.

## Core Contract

Your output must stay inside the Kanbn planning surface:

- `.kanbn/index.md`
- `.kanbn/tasks/*.md`

Do not create application code, tests, CI files, or documentation unrelated to the Kanbn board.

If the user asks for planning plus implementation, complete the planning portion in Kanbn format first and keep the planning files cleanly separated from any later work.

## Planning Goals

Produce a board that is both valid and useful:

- Break vague requirements into concrete, reviewable tasks.
- Capture prerequisite relationships with Kanbn relations.
- Preserve important scope, assumptions, risks, and milestones in task descriptions.
- Avoid invented execution history such as fake progress, comments, timestamps, or completed work.
- Keep the plan maintainable so a human can reprioritise it later.

## Workflow

### 1. Extract scope before writing files

From the user prompt or specification, identify:

- project goal
- major workstreams or epics
- prerequisites and external dependencies
- constraints, risks, and open questions
- any explicit milestones, deadlines, or sequencing requirements

If the prompt is underspecified, make minimal planning assumptions and state them in the index description or in task descriptions where relevant.

### 2. Choose a board shape

If the user does not specify columns, default to Kanbn's standard workflow:

- `Backlog`
- `Todo`
- `In Progress`
- `Done`

And default options:

- `startedColumns: ["In Progress"]`
- `completedColumns: ["Done"]`

Use extra columns only when the project brief clearly benefits from them, for example `Review`, `Testing`, `Release`, or domain-specific approval states.

Do not use columns to model architecture layers, epics, or teams when tags or task descriptions would be more appropriate. Columns should represent workflow state.

### 3. Decompose into actionable tasks

Each generated task should be:

- small enough to complete as one coherent unit of work
- specific enough that another agent or engineer can act on it later
- named by outcome, not by vague area labels
- independent where possible, but explicitly linked when not

Prefer imperative or outcome-focused names such as:

- `Define authentication flow`
- `Create database migration plan`
- `Document deployment rollback steps`

Avoid umbrella task names such as:

- `Backend`
- `Frontend work`
- `Finish project`

### 4. Model dependencies carefully

Use the relations section to encode sequencing.

Preferred relation types:

- `depends-on`: the current task cannot start until the referenced task is complete
- `blocks`: the current task prevents the referenced task from starting or finishing

Important rules:

- Use one direction per dependency edge. Do not create both `depends-on A` and `blocks B` for the same relationship unless the user explicitly asks for mirrored wording.
- Do not create self-references.
- Do not create cycles.
- Other relation types such as `duplicates` or `obsoletes` are allowed, but they are not scheduling dependencies.

Kanbn's gantt dependency logic only treats `depends-on` and `blocks` as dependency edges.

### 5. Write lean metadata

Only include metadata when it is grounded in the prompt or materially useful.

Safe defaults:

- omit YAML front matter entirely when no metadata is needed
- omit `created`, `updated`, `started`, `completed`, `progress`, `comments`, and `history`
- omit `assigned` unless the user supplied owners
- omit `due` unless the user supplied a deadline

Useful optional metadata:

- `tags` for epics, domains, or sizing labels
- custom fields only if the board already defines them

### 6. Place tasks in columns intentionally

For a fresh plan, use this default placement strategy unless the user specifies otherwise:

- put ready, near-term tasks with no unresolved prerequisites in `Todo`
- put deferred or dependency-blocked tasks in `Backlog`
- leave `In Progress` and `Done` empty unless the user explicitly says work has already started or finished

Do not fabricate active work.

### 7. Validate before finalising

Before presenting the plan, validate it if the environment allows.

Use these helper files from this skill when available:

- `references/index-structure.md`
- `references/task-structure.md`
- `references/planning-rules.md`
- `scripts/validate-kanbn.mjs`
- `scripts/check-dependency-cycles.mjs`

Validation sequence:

1. Ensure `.kanbn/index.md` uses valid headings and task links.
2. Ensure each task file has a valid title, description, and any reserved sections in the correct format.
3. Run the validate wrapper.
4. Run the dependency cycle checker.
5. Fix any structural or dependency issues before stopping.

## Output Standards

### Index requirements

The index must:

- contain exactly one level-1 project heading
- contain optional description text directly under the project heading
- define workflow columns with level-2 headings
- list task ids as markdown links to `tasks/<task-id>.md`

### Task requirements

Each task file must:

- live at `.kanbn/tasks/<task-id>.md`
- contain exactly one top-level heading with the human-readable task name
- include a description tailored to the task
- use reserved headings correctly when present: `Metadata`, `Sub-tasks`, `Relations`, `Comments`, `History`

Descriptions should usually include:

- the purpose of the task
- key scope boundaries
- expected deliverable or outcome
- acceptance criteria or completion signals when useful

### Task id rules

Use stable kebab-case ids derived from the task name.

Examples:

- `Set up CI pipeline` -> `set-up-ci-pipeline`
- `Plan data retention policy` -> `plan-data-retention-policy`

## When Revising An Existing Board

If `.kanbn/` already exists:

- preserve the existing board structure unless the user asked to redesign it
- preserve existing custom fields and option conventions
- avoid rewriting unrelated tasks
- add or edit only the planning artifacts needed for the requested plan change

## References

Use these files as the source of truth while authoring:

- `references/index-structure.md` for `.kanbn/index.md`
- `references/task-structure.md` for `.kanbn/tasks/*.md`
- `references/planning-rules.md` for decomposition and dependency heuristics

## Success Criteria

This skill is successful when it produces a Kanbn board that:

- accurately reflects the requested project scope
- is structurally valid
- contains actionable tasks instead of vague placeholders
- captures dependency order without cycles
- does not stray into implementation work
