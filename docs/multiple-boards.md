# Multiple Boards

A Kanbn workspace can hold more than one board. Every board is a markdown file directly inside the kanbn folder, in exactly the same format as `index.md`, and they all share one `tasks/` folder — so a single task can appear on several boards, in a different column on each.

Multi-board support is opt-in. A workspace that never creates a second board behaves, and produces files, exactly as it always has.

## Views or boards?

> **A view is a lens; a board is a place.** A view re-arranges, filters and groups the tasks that are already on a board — it is read-only, and nothing you do to a view changes where a task lives. A board is somewhere tasks actually live: a task is added to it, moved between its columns, and removed from it. If you want to *look at* the same work differently, use a view. If you want to *track* the same work in a different workflow, use a board.

See [Views](views.md) for the read-only option.

## The main board

`.kanbn/index.md` is the **main board**. Its slug is `index`, and `main` and `default` always resolve to it. If you have customised `indexFile` in your config file, the main board's slug is that filename without its extension, and `main` / `default` still resolve to it.

The main board is the default target of every command, so nothing changes for existing workspaces or scripts.

## Creating a board

```bash
kanbn init -b design -n "Design Pipeline" -d "Design work across the product" -c Ideas -c Designing -c "Signed Off"
```

That writes `.kanbn/design.md`:

```markdown
# Design Pipeline

Design work across the product

## Ideas

## Designing

## Signed Off
```

Board slugs are generated the same way task ids are, so they must be lowercase and hyphenated. A few slugs are reserved and rejected: `index`, `main`, `default`, and the names of your task and archive folders.

Running `kanbn init -b design` again updates the board's name, description and columns, in the same way `kanbn init` does for the main board.

A new board only picks up the default `startedColumns: [In Progress]` and `completedColumns: [Done]` if it actually has columns by those names — a board with its own workflow does not silently claim that "In Progress" started work and "Done" finished it.

## Listing boards

```bash
kanbn boards
```

```
2 boards:

index (main board)
  Main Project
  4 columns, 12 tasks, 25% complete, last modified 2026-08-27T11:49:17.314Z

design
  Design Pipeline
  Design work across the product
  3 columns, 4 tasks, 50% complete, last modified 2026-08-27T11:50:34.602Z
```

`kanbn boards --tasks` shows the cross-board picture — every task that appears on more than one board, and the column it occupies on each. Add `--all` to include tasks that are only on one board.

`kanbn boards --rename design ux --name "UX Pipeline"` renames a board, and `kanbn boards --delete design` deletes one. Deleting a board never deletes task files, but tasks that no other board references become untracked; if that would happen, they are listed and `-f` is required to go ahead.

Both listings support `--json`.

## Targeting a board

Every board-scoped command takes `-b` / `--board`:

```bash
kanbn board -b design
kanbn status -b design
kanbn task build-tenant-settings-page -b design
kanbn find -b design --tag Bug
kanbn validate -b design
```

The target board is resolved in this order:

1. `--board` / `-b`
2. the `KANBN_BOARD` environment variable
3. the `defaultBoard` option in your config file
4. the main board

There is deliberately no stateful "current board" — everything stays visible in your shell and in git-tracked markdown.

## Tracked, untracked, and tracked elsewhere

"Tracked" is workspace-scoped: a task is tracked if **any** board references it.

```bash
kanbn status -b design --untracked
```

reports two separate things:

- `untrackedTasks` — task files that are on no board at all;
- `tasksOnOtherBoards` — tasks that other boards track but this one doesn't, naming the board and column each one sits in. This is the useful half: it is the "what could I pull onto this board" list.

Once a workspace has more than one board, `kanbn status` also reports a `board` field naming the board it applied to. A single-board workspace produces exactly the output it always has.

`kanbn task <task-id>` lists the boards a task appears on, and the column it occupies on each, whenever there is more than one.

`kanbn find --all-boards` searches every board, annotating each result with the board and column it occupies. Without the flag, `find` is scoped to the target board as it always has been.

## Working with tasks across boards

Every board-scoped command takes `-b`, so a task can be created, moved, commented on and removed on whichever board you mean:

```bash
kanbn add -n "Task" -b design -c Ideas
kanbn move build-settings-page -b design -c Designing
kanbn remove build-settings-page -b design
kanbn edit build-settings-page -b design --tag Bug
```

`kanbn add -b` is repeatable, so one task can land on several boards at once. Each `-b` pairs with the `-c` in the same position; boards with no `-c` of their own use the first one given, and a board that hasn't got that column falls back to its first column with a notice:

```bash
kanbn add -n "Task" -b index -b design -b ops -c Todo -c Designing
```

With a *single* board an unknown column is still an error — the fallback only applies when several boards are named at once, where a column can legitimately exist on one and not another.

### Adding, moving and removing membership

- `kanbn move <task> -b design -c Designing` moves the task on the design board. If it isn't on that board yet, it is **added**, with a notice. `--no-add` turns that back into an error.
  The main board never adds implicitly: moving an untracked task there is an error either way.
- `kanbn remove <task> -b design --index` removes the task from the design board only. Boards own membership, so the task file and every other board are untouched.
- Without `--index`, `remove` deletes the task file as well, and that is refused while another board still references it. `--all-boards` removes the task from every board and then deletes the file.
- `kanbn rename <task>` rewrites the id on **every** board that references it, because the id is the file name.

Membership changes are recorded in the task's history as `added` and `removed` events, so a board's history includes the task arriving and leaving. See [Task Structure](task-structure.md#history).

### Archiving and restoring

Archiving removes a task from every board and remembers where it was on each:

```yaml
column: In Progress          # the main board, as it always has been
columns:                     # only written when the task was on more than one board
  design: Designing
  ops: Backlog
```

`kanbn restore <task>` puts it back on every board it was on, in the column it occupied on each. A board that has since been deleted, or a column that has since gone, is reported and skipped rather than failing the restore. `kanbn restore <task> -b design` restores to that board only.

## Options and configuration

Options resolve in layers when a board is loaded:

```
defaults  <  kanbn.yml / kanbn.json  <  boards.<slug> in config  <  board file front matter
```

Array options — `startedColumns`, `completedColumns`, `hiddenColumns`, `sprints`, `views` — **override** rather than merge. Element-wise merging of an ordered array has no predictable semantics.

Some options describe the workspace rather than a single board:

| Option | Scope |
| --- | --- |
| `hiddenColumns`, `startedColumns`, `completedColumns`, `startedField`, `completedField`, `columnSorting`, `views`, `taskTemplate`, `verbose` | Board |
| `sprints` | Workspace, overridable per board |
| `customFields` | Workspace — task files are shared, so a field defined on one board must parse on all |
| `contributors` | Workspace — `assigned: gordon` has to mean the same person on every board that references the task |
| `defaultTaskWorkload`, `taskWorkloadTags` | Workspace — workload is a property of the task, not the board |
| `dateFormat` | Workspace only — dates should read identically everywhere |
| `mainFolder`, `indexFile`, `taskFolder`, `archiveFolder`, `defaultBoard`, `boards` | Workspace only — layout, meaningless in a board file |

A workspace-scoped option in a *secondary* board's front matter is ignored, because one shared task file has to parse identically for every board that references it.

Where options are written:

- **Main board** — unchanged. If a config file exists, options go there; otherwise they go into `index.md`'s front matter.
- **Secondary boards** — board-scoped options are always written to that board file's front matter. A board-local operation never writes to the workspace config file.

If you have no config file, the workspace options live in the main board's front matter, so loading any secondary board also reads `index.md`. That costs one extra file read per process, not per board.

**Only workspace-scoped options are inherited from `index.md`'s front matter.** With no config file that file is doing double duty — it holds the workspace options *and* the main board's own board-scoped ones — so `startedColumns`, `completedColumns`, `hiddenColumns`, `views`, custom field column linkages and the rest stay with the main board. A secondary board that happens to share a column name with it does not silently pick up its behaviour; if you want those columns to mean the same thing on another board, declare them in that board's front matter.

A `kanbn.yml` / `kanbn.json` config file is different: it is workspace-level by construction, so a board-scoped option declared there is a deliberate statement about every board, and is inherited.

### Per-board state fields

Because `started` and `completed` live on the shared task file, a board that needs its own notion of started or completed can point at different metadata fields:

```markdown
---
startedField: designStartedAt
completedField: designSignedOffAt
startedColumns:
  - Designing
completedColumns:
  - Signed Off
---

# Design Pipeline
```

Declare `designStartedAt` and `designSignedOffAt` once as workspace-scoped `customFields` of type `date`. The design board then stamps and reads its own fields, and the main board's `completed` can never leak into it. See [Index Structure](index-structure.md) for `customFields`.

### Per-board sprints

Sprints are workspace-level by default: a board reads the workspace list unless it declares its own `sprints` in its front matter, in which case that list **replaces** the workspace one entirely.

`kanbn sprint -b design` appends to the workspace list, and says so, unless the design board has its own list — in which case it appends there, auto-named `Design Pipeline Sprint 2`. A board-local list is never created implicitly: forking is permanent and invisible in the CLI, so it stays a deliberate front-matter edit.

The cost of forking is worth stating plainly: a board with its own list can no longer see workspace sprints at all, so `kanbn status -b design -s "Foundation Sprint"` will fail to find it.

`--sprint` can't be combined with `--all-boards`, because sprint numbers and names are relative to one board's list.

`kanbn burndown -b <slug>` on a board that declares no `startedColumns` errors rather than drawing an empty chart — a board with no notion of work in progress has nothing to burn down. Gantt charts don't use sprints at all, so they are unaffected.

Note that a task on two boards contributes its workload to both boards' charts. That is correct for per-board reporting; it is only double counting if you add the charts together.

### History and charts are board-scoped

`kanbn history -b design` shows the events that happened on the design board, plus the ones that aren't board-scoped at all. Burndown datapoints are placed and annotated the same way, so activity on one board never puts markers on another board's chart.

`progress` and `archived` events are never filtered: progress is a property of the task, and archiving removes a task from every board.

### Validation

`kanbn validate` reports multi-board problems as warnings once a workspace has more than one board:

- a workspace-scoped option in a secondary board's front matter, which is ignored;
- several boards stamping the same shared `completedField`, where whichever board is touched first silently owns that date for every board;
- sprints out of chronological order, which the "current sprint" logic assumes;
- a task on no board at all, or referenced by a board with no file behind it;
- a task in two columns on the same board;
- history events naming a board that has been deleted;
- markdown files beside the boards that don't parse as one, and files excluded by `boards.exclude`.

`kanbn validate --all-boards` validates every board and its tasks, rather than just the target board.

### Board discovery

Boards are discovered by globbing `*.md` directly inside the kanbn folder, so `tasks/` and `archive/` are excluded by construction. A file counts as a board if it parses as an index — that is, if it has an H1. Files that don't parse are ignored during ordinary commands and reported by `kanbn validate`.

Where discovery isn't enough, the `boards` config key takes over:

```yaml
boards:
  exclude:
    - notes.md          # not a board, just a scratch file
  order:                # display order for `kanbn boards`
    - index
    - design
    - ops
  design:               # options applied to the design board
    hiddenColumns:
      - Ideas
```

`exclude` and `order` are reserved; every other key is a board slug whose value is that board's options.
