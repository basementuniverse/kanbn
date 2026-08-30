# Sprints

A sprint in Kanbn is nothing more than **a named point in time**. Each sprint has a start date, and
runs until the next sprint starts; the last sprint in the list is the current one, and runs up to
now. Nothing stores an end date or a duration, and there is no way for a sprint to be "closed" -
starting the next sprint is what ends the previous one, and any end date you see in reporting output
is derived from the next sprint's start.

Tasks are never assigned to a sprint. A sprint is a window that reporting commands measure through,
so which sprint a task belongs to is worked out from its dates (`created`, `started`, `completed`,
`due`) rather than being recorded anywhere on the task. This means sprints cost nothing to add
retrospectively, and moving a boundary re-slices history rather than invalidating it.

Sprints live in the [`sprints`](index-structure.md#sprints) index option:

```yaml
sprints:
  -
    start: 2026-07-01T09:00:00.000Z
    name: 'Foundation Sprint'
    description: 'Baseline product and infrastructure work.'
  -
    start: 2026-07-08T09:00:00.000Z
    name: 'Workflow Sprint'
```

`start` and `name` are required, `description` is optional.

## Starting a sprint

```bash
kanbn sprint --name "Workflow Sprint" --description "Core team workflow and onboarding features."
```

`kanbn sp` is the short alias. The sprint always starts *now* - there is no option to backdate one
from the CLI, so a sprint that should have started last Monday is a front matter edit.

| Option | Effect |
| --- | --- |
| `--name`, `-n` | Sprint name. If omitted, auto-named `Sprint {n}` from the number of existing sprints |
| `--description`, `-d` | Optional description, shown in `kanbn status` output |
| `--interactive`, `-i` | Prompt for name and (optionally) description |
| `--board`, `-b` | Run from the context of another board (see [below](#sprints-and-multiple-boards)) |

There is no command to rename, re-date or delete a sprint. All three are edits to the `sprints`
list in the board's front matter, which is deliberate: the sprint list is a small hand-maintainable
piece of history, and `kanbn sprint` only ever appends to it.

## Reading a sprint

Three commands take a `--sprint N|"name"` option (`-p` in every case). A sprint can be selected by
1-based number or by exact name; an unknown number or name is an error, not an empty result.

### `kanbn status --sprint`

Adds a `sprint` section to the status output for the selected sprint, defaulting to the current one:

```bash
kanbn status --sprint 2
kanbn status --sprint "Workflow Sprint"
```

```yaml
sprint:
  number: 2
  name: 'Workflow Sprint'
  start: 2026-07-08T09:00:00.000Z
  end: 2026-07-15T09:00:00.000Z
  current: 3
  description: 'Core team workflow and onboarding features.'
  durationDelta: 604800000
  durationMessage: '1 week'
  created:   # tasks created during the sprint, with their total workload
  started:   # tasks started during the sprint
  completed: # tasks completed during the sprint
  due:       # tasks due during the sprint
```

Each of those four groups lists the matching task ids with their column and workload, plus a summed
`workload`. Any [custom date fields](index-structure.md#customfields) you have declared get a group
of their own too.

`current` and `end` only appear when you're looking at a sprint other than the current one: `current`
is the number of the sprint that is running now, and `end` is the moment the sprint you asked about
stopped, which is the next sprint's `start`. The current sprint has no `end`, because it hasn't
ended - its `durationDelta` and `durationMessage` are measured up to now, and will be larger every
time you run the command until the next sprint starts.

### `kanbn burndown --sprint`

```bash
kanbn burndown --sprint "Workflow Sprint"
kanbn burndown --sprint 1 --sprint 2
```

Plots remaining workload across the sprint window. `--sprint` can be repeated to draw a chart per
sprint. With no `--sprint` or `--date` at all, burndown uses the current sprint - and if no sprints
are defined, it falls back to all time, from the earliest task date to now.

### `kanbn history --sprint`

```bash
kanbn history --sprint 2
```

Filters the event listing down to events that fall inside the sprint window. Repeatable, and
combinable with `--assigned`, `--task` and `--date`.

Gantt charts don't use sprints at all.

## Sprints and multiple boards

Sprints are workspace-level by default: every board reads the workspace list, so one sprint cadence
covers the whole workspace and `kanbn sprint -b design` appends to that shared list (and says so in
verbose mode).

A board that declares its own `sprints` in its front matter **replaces** the workspace list for
itself entirely - it can no longer see workspace sprints, so `kanbn status -b design -p "Foundation
Sprint"` will fail to find one that only exists at workspace level. Sprints started on such a board
are auto-named `{Board name} Sprint {n}` so two boards' sprints can't be confused. Forking is never
implicit; it stays a deliberate front matter edit. See
[multiple boards](multiple-boards.md#per-board-sprints).

`--sprint` can't be combined with `--all-boards`, because sprint numbers and names are relative to
one board's list.

## Keeping the list sane

The "current sprint is the last one" and "a sprint runs until the next one starts" rules both assume
the list is in chronological order. `kanbn validate` emits a `sprints-out-of-order` warning if it
isn't - worth checking after hand-editing dates.

## Example workflow

A team working in weekly sprints, reviewing at the end of each one.

Start the first sprint on the Monday:

```bash
kanbn sprint -n "Foundation Sprint" -d "Baseline product and infrastructure work."
```

Work the week normally - `kanbn add`, `kanbn move`, `kanbn comment`. Nothing needs to reference the
sprint; the dates Kanbn stamps on tasks as they're created, started and completed are what the
sprint reporting reads.

Check progress mid-week:

```bash
kanbn status --due
kanbn burndown --normalise auto
```

With no `--sprint`, both default to the current sprint, so this is the "how is this week going"
view.

On the following Monday, review what the week actually contained, then start the next sprint:

```bash
kanbn status --sprint "Foundation Sprint"
kanbn history --sprint "Foundation Sprint"
kanbn sprint -n "Workflow Sprint" -d "Core team workflow and onboarding features."
```

Starting the second sprint closes the first one at that moment, and the reports above stay valid
for it forever - `kanbn status -p 1` and `kanbn burndown -p 1` will show the same window next month.

Comparing two sprints later on:

```bash
kanbn burndown -p "Foundation Sprint" -p "Workflow Sprint"
```

The [`example/basic`](../example/basic) workspace ships with three sprints defined, so every command
on this page can be run there as-is.
