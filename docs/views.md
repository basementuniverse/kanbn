# Views

A view is a saved board layout. Views let you re-arrange, filter and group the same set of tasks without changing the index columns or moving any tasks around.

Views are defined in the `views` project option (index front matter, or `kanbn.json` / `kanbn.yml` — see [Advanced Configuration](advanced-configuration.md)) and are selected with:

```bash
kanbn board --view "view name"
kanbn board -v "view name"
```

If the named view doesn't exist, `kanbn board` reports an error. Running `kanbn board` with no `--view` option always uses the [default board](#the-default-board), even if a view called `default` exists.

A working example lives in [`example/views`](../example/views).

## Structure

```yaml
views:
  - name: 'View name'          # required
    filters: {}                # optional, applied to every task before columns and lanes
    columns:                   # optional, at least 1 entry if present
      - name: 'Column name'    # required, this is the board heading
        filters: {}            # optional
        sorters: []            # optional
    lanes:                     # optional
      - name: 'Lane name'      # required
        filters: {}            # optional
```

| Property | Where | Required | Description |
| --- | --- | --- | --- |
| `name` | view | yes | The name passed to `kanbn board --view`. If two views share a name, the first one wins |
| `filters` | view | no | A [filter set](filtering-and-sorting.md#filters) applied to all tasks before anything else |
| `columns` | view | no | The board columns, left to right. Defaults to the index columns |
| `columns[].name` | column | yes | The column heading. It does **not** have to be an index column name |
| `columns[].filters` | column | no | A [filter set](filtering-and-sorting.md#filters) deciding which tasks appear in this column |
| `columns[].sorters` | column | no | A [sorter list](filtering-and-sorting.md#sorters) for tasks in this column |
| `lanes` | view | no | Horizontal swimlanes, top to bottom. Defaults to a single lane called "All tasks" |
| `lanes[].name` | lane | yes | The lane label |
| `lanes[].filters` | lane | no | A [filter set](filtering-and-sorting.md#filters) applied to every column in this lane |

Anything else is ignored. In particular there is **no** `hidden` property on view columns — to leave a column out of a view, just don't list it.

## How a view is built

For every lane, and for every column in that lane, Kanbn takes the full list of tracked tasks and:

1. applies the view's root `filters` (if any);
2. merges the column's `filters` with the lane's `filters` and applies the result;
3. sorts what's left using the column's `sorters`.

The merge in step 2 is a shallow object merge with the **lane winning**: if a column and a lane both filter on the same field, the lane's value is used. Filters on different fields combine with AND.

Two consequences worth knowing:

- **A column with no `filters` shows every task**, in every lane, regardless of which index column the tasks are actually in. Column names in a view are just labels. If you want a view column to show one index column, filter on it explicitly:

  ```yaml
  - name: 'In Progress'
    filters:
      column: 'In Progress'
  ```

- **Views can overlap.** The same task can appear in more than one column or lane if it matches more than one filter set. That's often what you want (a "Bugs" and an "Overdue" column side by side), but it does mean a view is not necessarily a partition of the board.

## The default board

When a view doesn't define `columns`, Kanbn builds them from the index: one column per index column, in index order, each filtered to `column: <that column name>`, and [`hiddenColumns`](index-structure.md#hiddencolumns) removed.

`hiddenColumns` is only consulted when building this default column list. **A view that defines its own `columns` ignores `hiddenColumns` entirely**, so a view is also the way to see hidden columns:

```yaml
views:
  - name: 'everything'
    columns:
      - name: 'All tasks (including hidden columns)'
        sorters:
          - field: column
            order: ascending
```

When a view doesn't define `lanes` (or defines an empty list), a single lane called "All tasks" is used.

## Lanes

A lane is a horizontal band across the whole board. Every column is rendered once per lane, filtered by that lane's filters. Lanes are for grouping the same columns by some secondary dimension: assignee, tag, workload, priority, and so on.

```yaml
views:
  - name: 'by-assignee'
    columns:
      - name: 'Backlog'
        filters:
          column: 'Backlog'
      - name: 'In Progress'
        filters:
          column: 'In Progress'
      - name: 'Done'
        filters:
          column: 'Done'
    lanes:
      - name: 'Ana'
        filters:
          assigned: '^Ana$'
      - name: 'Ben'
        filters:
          assigned: '^Ben$'
      - name: 'Unassigned'
        filters:
          assigned: '^$'
```

```
╭──────────────────────┬──────────────────────┬──────────────────────╮
│Backlog               │» In Progress         │✓ Done                │
├──────────────────────┼──────────────────────┼──────────────────────┤
│Ana                   │                      │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│Add Audit Log Export  │Fix Expired Session   │Add Dark Mode Toggle  │
│                      │Redirect              │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│Ben                   │                      │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│Fix Avatar Upload     │Build Webhook Retry   │                      │
│Crash                 │Queue                 │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│Unassigned            │                      │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│Rewrite Search        │                      │                      │
│Indexer               │                      │                      │
│                      │                      │                      │
│Tidy Up Settings Copy │                      │                      │
╰──────────────────────┴──────────────────────┴──────────────────────╯
```

Because `assigned` is a [string filter](filtering-and-sorting.md#string-filters) matched as a regex, `'^Ana$'` matches only tasks assigned to exactly "Ana" (a bare `Ana` would also match "Ana-Maria"), and `'^$'` matches unassigned tasks, whose `assigned` value is treated as an empty string.

*Note: a task that matches no lane filter simply isn't shown. Lanes don't have a catch-all.*

## Examples

All of these are in [`example/views/.kanbn/index.md`](../example/views/.kanbn/index.md) and can be run from the `example/views` directory.

### Group by workload

Columns as workload buckets, lanes splitting started from not-started work. Neither the columns nor the lanes correspond to index columns:

```yaml
- name: 'workload'
  columns:
    - name: 'Small (1-2)'
      filters:
        workload: [1, 2]
    - name: 'Medium (3-5)'
      filters:
        workload: [3, 5]
    - name: 'Large (6+)'
      filters:
        workload: [6, 99]
  lanes:
    - name: 'Not started'
      filters:
        column: 'Backlog'
    - name: 'Started'
      filters:
        column: 'In Progress'
```

### Root filter plus per-column sorting

The root `filters` narrows the whole view to bugs; the first column narrows further by due date and sorts by workload; the second column has no filters, so within this view it shows all bugs:

```yaml
- name: 'triage'
  filters:
    tag: Bug
  columns:
    - name: 'Due before Aug 2026'
      filters:
        due:
          - 2020-01-01
          - 2026-08-01
      sorters:
        - field: workload
          order: descending
    - name: 'All bugs'
      sorters:
        - field: name
          order: ascending
```

## Inspecting a view

`kanbn board --json` (with or without `--view`) prints the resolved board rather than rendering it, which is the quickest way to check that a view's filters do what you expect:

```bash
kanbn board -v triage --json
```

```json
{
  "headings": [
    { "name": "Due before Aug 2026", "heading": "^:^+Due before Aug 2026^:" },
    { "name": "All bugs", "heading": "^:^+All bugs^:" }
  ],
  "lanes": [
    {
      "name": "All tasks",
      "columns": [
        [
          { "id": "fix-expired-session-redirect", "workload": 3, "...": "..." },
          { "id": "fix-avatar-upload-crash", "workload": 2, "...": "..." }
        ],
        [
          { "id": "fix-avatar-upload-crash", "...": "..." },
          { "id": "fix-expired-session-redirect", "...": "..." }
        ]
      ]
    }
  ]
}
```

## Limitations

- View column `sorters` accept the same fields as `kanbn sort` and `columnSorting`, plus `column`. See [sortable fields](filtering-and-sorting.md#sortable-fields).
- Views only affect `kanbn board`. `kanbn find`, `kanbn status`, `kanbn burndown`, `kanbn gantt` and `kanbn history` don't take a `--view` option.
- Views are read-only: `kanbn move` and `kanbn add` still work in terms of index columns, not view columns.
