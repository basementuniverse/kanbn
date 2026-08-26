---
startedColumns:
  - 'In Progress'
completedColumns:
  - Done
hiddenColumns:
  - Icebox
taskWorkloadTags:
  Tiny: 1
  Small: 2
  Medium: 3
  Large: 5
  Huge: 8
views:

  # The index columns, spelled out explicitly. Note that a view column with no
  # filters would show *every* task, not the tasks in a column of that name.
  - name: 'default'
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

  # The same columns, grouped into one lane per assignee.
  # Lane filters are merged over each column's filters.
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

  # A root filter narrows the whole view to bugs before columns are built.
  # The second column has no filters, so within this view it shows all bugs.
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

  # Columns and lanes don't have to correspond to index columns at all.
  - name: 'workload'
    columns:
      - name: 'Small (1-2)'
        filters:
          workload:
            - 1
            - 2
      - name: 'Medium (3-5)'
        filters:
          workload:
            - 3
            - 5
      - name: 'Large (6+)'
        filters:
          workload:
            - 6
            - 99
    lanes:
      - name: 'Not started'
        filters:
          column: 'Backlog'
      - name: 'Started'
        filters:
          column: 'In Progress'

  # A view that defines its own columns ignores hiddenColumns, so this one
  # also shows tasks in the hidden Icebox column.
  - name: 'everything'
    columns:
      - name: 'All tasks (including Icebox)'
        sorters:
          - field: column
            order: ascending
          - field: name
            order: ascending
---

# Views Example

A small board used to demonstrate views, lanes, filters and sorters. Try:

- `kanbn board`
- `kanbn board -v default`
- `kanbn board -v by-assignee`
- `kanbn board -v triage`
- `kanbn board -v workload`
- `kanbn board -v everything`

## Backlog

- [add-audit-log-export](tasks/add-audit-log-export.md)
- [fix-avatar-upload-crash](tasks/fix-avatar-upload-crash.md)
- [rewrite-search-indexer](tasks/rewrite-search-indexer.md)
- [tidy-up-settings-copy](tasks/tidy-up-settings-copy.md)

## In Progress

- [fix-expired-session-redirect](tasks/fix-expired-session-redirect.md)
- [build-webhook-retry-queue](tasks/build-webhook-retry-queue.md)

## Done

- [add-dark-mode-toggle](tasks/add-dark-mode-toggle.md)

## Icebox

- [investigate-offline-mode](tasks/investigate-offline-mode.md)
