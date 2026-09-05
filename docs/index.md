# Kanbn Documentation

This is a CLI kanban board application. The kanban board and tasks live inside your repository as markdown files, so they are easy to read and edit in your IDE and you can benefit from source control, version history etc.

To get started quickly, check out the [Quick Start](quick-start.md) guide.

## Contents

- [Quick Start](quick-start.md)
- [Library API](api.md) — using `@basementuniverse/kanbn` as a dependency instead of the CLI
- [Index Structure](index-structure.md) — the board file and all project options
- [Task Structure](task-structure.md) — task files, metadata, sub-tasks, relations, comments and history
- [Multiple Boards](multiple-boards.md) — several boards over one shared pool of tasks
- [Contributors](contributors.md) — an optional list of who works on a workspace, and who "you" are
- [Actions](actions.md) — declarative rules that fire when a task is created, moved, updated or finished
- [Views](views.md) — custom board layouts, columns and lanes
- [Sprints](sprints.md) — named time windows that `status`, `burndown` and `history` report through
- [Filtering and Sorting](filtering-and-sorting.md) — the filter and sorter model shared by `find`, `sort` and views
- [Advanced Configuration](advanced-configuration.md)
- [Migrating to 2.0.0](migration-2.0.md) — separate config files and custom folder locations

## Examples

The [`example`](../example) directory contains ready-to-run workspaces:

| Example | Demonstrates |
| --- | --- |
| [`example/basic`](../example/basic) | A typical board: columns, tags, workload, sprints |
| [`example/views`](../example/views) | Views, lanes, filters and sorters |
| [`example/boards`](../example/boards) | Multiple boards over one shared pool of tasks, with per-board state fields |
| [`example/advanced`](../example/advanced) | A `kanbn.yml` config file, custom fields, contributors, column sorting and a custom task template |

Run any Kanbn command from inside one of those directories to try it out.

## Command help

Every command has built-in help:

```bash
kanbn help <command>
kanbn <command> --help
```
