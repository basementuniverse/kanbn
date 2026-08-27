# Kanbn Examples

Each subdirectory is a self-contained Kanbn workspace. `cd` into one and run any Kanbn command
against it — nothing here affects the boards in the other directories.

```bash
cd example/views
kanbn board -v by-assignee
```

The index and config files in these examples are commented so they can be read as documentation.
Kanbn rewrites those files whenever it saves (`kanbn add`, `kanbn move`, `kanbn sort --save`,
`kanbn validate --save`, ...), which reformats the YAML and strips the comments — so run mutating
commands on a copy if you want to keep them.

## [`basic`](basic)

A typical in-flight product board. Demonstrates the core setup you get from `kanbn init`:

- columns, with `startedColumns` and `completedColumns`
- tags and `taskWorkloadTags` for workload calculation
- `sprints`
- tasks with sub-tasks, `assigned`, `progress`, `due` and `## History` sections

```bash
kanbn board
kanbn status --due
kanbn burndown -p "Workflow Sprint"
kanbn gantt
```

## [`views`](views)

Custom board layouts. See [Views](../docs/views.md).

- `default` — the index columns, spelled out explicitly
- `by-assignee` — the same columns, split into one lane per assignee plus an "Unassigned" lane
- `triage` — a root filter narrowing the whole view to bugs, plus per-column filters and sorters
- `workload` — columns as workload buckets and lanes as started/not-started
- `everything` — a single column showing every task, including the hidden `Icebox` column

```bash
kanbn board
kanbn board -v by-assignee
kanbn board -v triage
kanbn board -v workload
kanbn board -v everything
kanbn board -v triage --json
```

## [`boards`](boards)

Several boards over one shared pool of tasks. See [Multiple Boards](../docs/multiple-boards.md).

- an engineering board in [`index.md`](boards/.kanbn/index.md) and a design board in
  [`design.md`](boards/.kanbn/design.md), sharing one `tasks/` folder
- three tasks that sit in **different columns on each board** - including one that design has started
  and engineering hasn't
- `startedField` / `completedField` on the design board, so design progress is tracked in its own
  metadata fields rather than in the shared `started` / `completed` dates
- board-scoped options in each board's front matter, and workspace-scoped `customFields` in the main
  board's - where they are inherited by both

```bash
kanbn boards
kanbn boards --tasks
kanbn board -b design
kanbn status -b design --untracked
kanbn task build-tenant-settings-page
kanbn find --all-boards
kanbn validate --all-boards
```

## [`advanced`](advanced)

Project configuration beyond the defaults. See
[Advanced Configuration](../docs/advanced-configuration.md).

- all project options live in [`kanbn.yml`](advanced/kanbn.yml) instead of the index front matter
- `customFields` (`team`, `storyPoints`, `needsDesign`, `reviewedAt`) that can be set, searched and sorted
- `reviewedAtColumns`, which stamps `reviewedAt` the first time a task enters the `Review` column
- `columnSorting`, which keeps `Backlog` sorted by workload in the index file itself
- a custom `taskTemplate` and `dateFormat`
- a hidden `Blocked` column

```bash
kanbn board
kanbn find --team Platform
kanbn find --storyPoints 3 --storyPoints 8
kanbn find --needsDesign
kanbn find --no-needsDesign
kanbn sort "Backlog" --workload -z --name -a --save
```
