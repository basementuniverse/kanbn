---
name: kanbn-replan
description: Recalculate unfinished Kanbn task dates from the current project state, preserving completed tasks and writing updated scheduled dates back to existing task markdown files.
---

# Kanbn Replan

Use this skill when a Kanbn board needs to be rescheduled after time has passed, work was paused, or the current Gantt chart shows that unfinished work no longer fits the available timeline.

Do not use this skill to redesign scope, rewrite completed tasks, or invent new task structure. Keep the workflow focused on rescheduling existing incomplete work.

## Core Contract

Your output must stay inside the Kanbn task surface:

- `.kanbn/index.md`
- `.kanbn/tasks/*.md`

You may read the current board and gantt output, but the end result should be a revised schedule for existing tasks, not a new plan.

Do not modify completed tasks unless the user explicitly asks to reopen them. Leave completed task descriptions, relations, and completion history intact.

## When to Use

Use this skill when the user wants to:

- move overdue work forward to a realistic schedule
- reschedule unfinished tasks after a long interruption
- spread work out to reduce overload
- refresh `started`, `due`, and `postponed` dates for incomplete tasks
- inspect Gantt output and derive a revised schedule from it

## Workflow

### 1. Inspect the current board state

Gather the current planning context before making edits:

- current date
- tracked tasks and their columns
- task metadata relevant to scheduling (`started`, `due`, `postponed`, `progress`, workload tags)
- dependency relations
- the current Gantt layout

Prefer `kanbn gantt -j` for the machine-readable schedule. If the replanning should be anchored to a specific point in time, pass `--now "date"` so the schedule is evaluated against the intended date.

### 2. Decide what is in scope

Reschedule only incomplete work.

Treat these as locked unless the user says otherwise:

- tasks marked complete
- completed subtasks that should remain completed
- task names, descriptions, comments, and history
- dependency structure, unless the task graph itself is wrong and must be repaired to make the schedule valid

If a task is incomplete but already in progress, preserve evidence of work where that matters. Prefer updating scheduling metadata over rewriting task content.

### 3. Rebuild the schedule

Use the gantt data and dependency order to decide new dates.

General rules:

- dependency order wins over wishful dates
- `postponed` should be the earliest start floor when present
- `started` should reflect when work actually begins or resumes
- `due` should reflect the target finish date for the current schedule
- if a task would otherwise overlap too much with adjacent work, shift it later rather than ignoring the overload
- if the user has returned after a long gap, treat incomplete tasks as candidates for re-baselining from the current date forward

When task size information is available, use it to distribute work more realistically. If exact sizing is missing, use the gantt layout, task relations, and existing metadata as the primary signals.

If `kanbn gantt -j` reports dependency cycles, stop and resolve or report them before rescheduling dependent tasks.

### 4. Edit task files directly

Update the existing `.kanbn/tasks/*.md` files rather than creating a new board.

Prefer minimal metadata changes:

- keep task titles and descriptions stable
- update only the date fields needed to express the new plan
- preserve completed tasks exactly as they are
- avoid changing `created`, `completed`, comments, or history unless the user explicitly asks

If the task file format uses front matter or a `Metadata` section, keep it valid and consistent with the repo docs.

### 5. Verify the result

After editing, validate the board:

1. Run `kanbn validate`
2. Re-run `kanbn gantt -j` to confirm the new dates produce a coherent schedule
3. Check for obvious dependency or date regressions
4. Fix any malformed task files before stopping

## Scheduling Heuristics

Use these heuristics when the user has not specified a custom policy:

- keep completed tasks unchanged
- schedule tasks in dependency order
- move overdue unfinished tasks forward if they cannot realistically finish on their original due dates
- avoid piling every incomplete task onto the earliest possible date
- keep `due` dates aligned with the revised execution window
- if a task has no meaningful `started` date yet, set it when work is planned to resume rather than inventing a long-past start
- use workload tags and any existing custom scheduling fields as additional inputs when the board defines them

## References

Use the repo docs as the source of truth for the data model and commands:

- `docs/commands/gantt.txt`
- `docs/commands/edit.txt`
- `docs/commands/validate.txt`
- `docs/task-structure.md`
- `docs/index-structure.md`

