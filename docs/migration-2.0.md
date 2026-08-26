# Migrating to 2.0.0

Version 2.0.0 changes how kanbn decides whether a task has started or been completed. Everything else about the file format is unchanged: your `index.md` and task files are read and written exactly as before, and no migration step is required to open an existing board.

## What changed

**Before**, a task counted as complete if *either* it had a `completed` date *or* it was sitting in a column listed in `completedColumns`. The same applied to `started` and `startedColumns` when drawing burndown charts.

**Now**, only the dates count. A task has started if its `started` date is set, and it is complete if its `completed` date is set.

Columns still cause those dates to be written. Moving a task into a completed column through `kanbn move`, `kanbn edit -c`, or the VSCode extension sets its `completed` date exactly as it did before. What's changed is that the column no longer *stands in for* the date.

## Why

Inferring state from columns produced results that contradicted themselves and couldn't be corrected:

* `kanbn status --due` could report a task as `completed: true` with `completedDate: null` - complete, but with no record of when.
* Burndown charts substituted a task's **created** date when it had no started date, inventing timings unrelated to when the work happened.
* State could only ever move forwards. Once a `completed` date was written, moving the task back out of the column didn't clear it, and there was no command that could.
* A task could be complete on one board and not another purely because of what its columns were called - which becomes a real problem now that a task can appear on several boards.

## What you might notice

* **Tasks moved by hand.** If you moved a task between columns by editing `index.md` directly, or a git merge moved it, no date was written. Those tasks will now show as not started or not complete.
* **Burndown charts will look different** for any board where dates and columns disagreed.
* **Generated boards.** Tasks written by a tool or an AI assistant may sit in `Done` without a `completed` date.

Boards that have only ever been driven through the CLI or the VSCode extension already have the right dates and won't change.

## Fixing up an existing board

```
kanbn validate
```

reports every task whose dates and column disagree, in both directions:

```
2 tasks have dates that don't match their column:
  bravo: task is in column "In Progress" but has no started date
  alpha: task is in column "Done" but has no completed date
```

```
kanbn validate --fix
```

fills in the missing dates. Each date is taken from the task's own history, where the move into that column is recorded, so the backfilled dates reflect when the move actually happened:

```
Filled in 2 missing dates:
  bravo: started set to 2026-08-14T09:12:04.000Z (from history)
  alpha: completed set to 2026-08-19T16:40:11.000Z (from history)
```

If a task has no history recording the move, the date falls back to the task's `updated` date, then its `created` date. The source is always reported so you can see which dates were guessed.

Tasks that have a `completed` date while sitting **outside** a completed column are reported but never changed - the date records something that really happened, and removing it automatically would lose it.

`kanbn board` and `kanbn status` print a one-line reminder when a board has drifted. Set `verbose: false` in your project options to suppress it.

## Clearing a date

There is now a way to remove a date, which is what makes the dates trustworthy as the single source of truth:

```
kanbn edit "my-task" --unset completed
```

This reopens a completed task. It works for `started`, `completed`, `due`, `plannedStart`, `plannedFinish`, `assigned`, `progress`, `tags`, and any custom field. If the same command also moves the task into a completed column, the unset is applied last, so it wins.

## Per-board state fields

Two new project options, `startedField` and `completedField`, name the metadata fields a board reads and writes. They default to `started` and `completed`.

Pointing them at custom date fields lets one task carry separate state for separate workflows:

```yaml
completedField: designSignedOffAt
completedColumns:
  - Signed Off
customFields:
  - name: designSignedOffAt
    type: date
```

A board configured this way writes and reads `designSignedOffAt` and leaves the shared `completed` field alone.

## Other changes in 2.0.0

* **Task ids ending in a single capital letter are now fully lowercased.** `kanbn add -n "Task A"` previously produced the id `task-A`; it now produces `task-a`. Non-ASCII capitals are lowercased too. Existing task files are not renamed.
* **Unknown history event types and keys are preserved** rather than rejected, so a task file written by a newer version of kanbn stays readable.
