# Filtering and Sorting

Kanbn uses one shared filtering model and one shared sorting model. They are used by:

| Feature | Filters | Sorters |
| --- | --- | --- |
| `kanbn find` | yes (CLI options) | no |
| `kanbn sort` | no | yes (CLI options) |
| `columnSorting` project option | no | yes |
| [Views](views.md) (root, column and lane filters) | yes | yes (per view column) |

`kanbn status`, `kanbn burndown`, `kanbn gantt` and `kanbn history` have their own simpler `--column` / `--assigned` / `--date` / `--sprint` options and don't use this model.

## Filters

A filter set is a map of field names to filter values. **A task must match every filter in the set** (filters are combined with AND). An empty filter set matches all tasks.

On the command line each `kanbn find` option is one filter. In the index options a filter set is a YAML object:

```yaml
filters:
  column: 'In Progress'
  tag: Bug
  workload:
    - 3
    - 8
```

### Filter fields

| Field | `kanbn find` option | Type | Matched against |
| --- | --- | --- | --- |
| `id` | `--id` | string | The task id (the task filename without `.md`) |
| `name` | `--name`, `-n` | string | The task name (level-1 heading) |
| `description` | `--description`, `-d` | string | The task description |
| `column` | `--column`, `-c` | string | The name of the column the task is currently in |
| `created` | `--created` | date | `created` metadata |
| `updated` | `--updated` | date | `updated` metadata |
| `started` | `--started` | date | `started` metadata |
| `completed` | `--completed` | date | `completed` metadata |
| `due` | `--due`, `-e` | date | `due` metadata |
| `plannedStart` | `--plannedStart` | date | `plannedStart` metadata |
| `plannedFinish` | `--plannedFinish` | date | `plannedFinish` metadata |
| `assigned` | `--assigned` | string | `assigned` metadata (empty string if unset). `@me` on the command line expands to the [current user](contributors.md#the-current-user) |
| `workload` | `--workload` | number | The task's [calculated workload](index-structure.md#taskworkloadtags) |
| `progress` | `--progress` | number | The task's [calculated progress](task-structure.md#progress) |
| `sub-task` | `--sub-task`, `-s` | string | All sub-tasks, one per line, as `[ ] text` or `[x] text` |
| `count-sub-tasks` | `--count-sub-tasks` | number | Number of sub-tasks |
| `tag` | `--tag`, `-t` | string | All tags, one per line |
| `count-tags` | `--count-tags` | number | Number of tags |
| `relation` | `--relation`, `-r` | string | All relations, one per line, as `type task-id` |
| `count-relations` | `--count-relations` | number | Number of relations |
| `comment` | `--comment` | string | All comments, one per line, as `author text` |
| `count-comments` | `--count-comments` | number | Number of comments |
| *custom field name* | `--<custom field name>` | declared type | The custom field value in the task metadata |

Custom fields must be declared in the [`customFields`](index-structure.md#customfields) project option before they can be filtered on.

A task that doesn't have the metadata field being filtered on never matches a date filter or a custom field filter. Missing `assigned` is treated as an empty string, missing `tags`/sub-tasks/relations/comments are treated as empty.

*Note: `hiddenColumns` only affects the board. `kanbn find` still returns tasks in hidden columns unless you filter them out with `column`.*

`@me` is substituted where the argument is parsed, so it works for `kanbn find --assigned @me` and for the simpler `--assigned` options on `kanbn burndown`, `kanbn gantt` and `kanbn history`. It is never interpreted when *setting* a value, and never inside a task file. If Kanbn can't work out who you are, `@me` is an error rather than a filter that quietly matches everything.

### String filters

String filter values are **case-insensitive regular expressions**, matched anywhere in the value (not anchored). Passing an array (or repeating a CLI option) joins the values with `|`, so an array means "match any of these":

```bash
kanbn find --column Todo --column "In Progress"
```

```yaml
filters:
  column:
    - Todo
    - 'In Progress'
```

Multi-value fields (`tag`, `sub-task`, `relation`, `comment`) are flattened into a single newline-separated string before matching. The regex is **not** built with the multiline flag, so `^` and `$` anchor to the start and end of that whole string, not to each line. To match a single value exactly, anchor on the line breaks instead:

```bash
# Matches "Bug", but also "Debug" and "Bugfix"
kanbn find --tag Bug

# Matches only the exact tag "Bug"
kanbn find --tag '(^|\n)Bug($|\n)'
```

### Date filters

A single date matches any task whose date falls on **the same calendar day** — the time part is ignored:

```bash
kanbn find --due "20 July 2026"
```

Two or more dates match any task whose date falls **between the earliest and latest** of them (inclusive, times included):

```bash
kanbn find --due "1 July 2026" --due "31 July 2026"
```

On the command line dates are parsed with [chrono](https://github.com/wanasit/chrono), so almost any format works, including relative dates like `"yesterday"` or `"next friday"`. In YAML, write dates as plain YAML timestamps:

```yaml
filters:
  due:
    - 2026-07-01
    - 2026-07-31
```

### Number filters

A single number matches that number exactly. Two or more numbers match anything between the lowest and highest (inclusive):

```bash
kanbn find --workload 5              # exactly 5
kanbn find --workload 3 --workload 8 # between 3 and 8
```

### Boolean filters

Boolean filters only apply to custom fields with type `boolean`, and are matched by exact equality. On the command line, `--<name>` matches `true` and `--no-<name>` matches `false`:

```bash
kanbn find --needsDesign     # tasks where needsDesign is true
kanbn find --no-needsDesign  # tasks where needsDesign is false
```

## Sorters

A sorter list is an ordered array. Tasks are compared using the first sorter; ties are broken using the next one, and so on. Each sorter is an object:

```yaml
sorters:
  - field: workload
    order: descending
  - field: name
    filter: ''
    order: ascending
```

| Property | Required | Description |
| --- | --- | --- |
| `field` | yes | The task field to sort by |
| `order` | no | `ascending` (default) or `descending` |
| `filter` | no | A regex used to transform values before comparing them (see below) |

Strings are compared with `localeCompare` (accent-sensitive, case-insensitive); dates and numbers are compared numerically.

### Sort filters

The `filter` property is **not** a search filter — it extracts part of each value before comparing. The regex is applied globally and case-insensitively, and:

- if it has named capturing groups, the contents of all named groups are concatenated;
- otherwise, if it has numbered capturing groups, the contents of the first group are used;
- otherwise, the whole match is used;
- if there are multiple matches, their results are concatenated.

```bash
# Sort by the number in task names like "Task 12", not by the whole name
kanbn sort "Todo" --name "Task (\d+)"
```

### Sortable fields

`kanbn sort` and `columnSorting` can sort by any of these. Note that the `field` value written in YAML is **not** always the same as the command line option:

| `field` value | `kanbn sort` option |
| --- | --- |
| `id` | `--id` |
| `name` | `--name`, `-n` |
| `description` | `--description`, `-d` |
| `created` | `--created` |
| `updated` | `--updated` |
| `started` | `--started` |
| `completed` | `--completed` |
| `due` | `--due`, `-e` |
| `plannedStart` | `--plannedStart` |
| `plannedFinish` | `--plannedFinish` |
| `assigned` | `--assigned` |
| `workload` | `--workload`, `-w` |
| `progress` | `--progress` |
| `subTasks` | `--sub-task`, `-s` |
| `countSubTasks` | `--count-sub-tasks` |
| `tags` | `--tag`, `-t` |
| `countTags` | `--count-tags` |
| `relations` | `--relation`, `-r` |
| `countRelations` | `--count-relations` |
| `comments` | `--comment` |
| `countComments` | `--count-comments` |
| *custom field name* | `--<custom field name>` |

[View](views.md) column `sorters` accept all of the same fields, plus `column` (the index column the task is currently in), which is useful in a view whose columns don't map onto index columns.

A view sorter only changes the order within that view. To order a column permanently, use `columnSorting` — that ordering is written to the index itself, and view columns with no `sorters` of their own inherit it.

## Persistent column sorting

`columnSorting` keeps a column sorted in the index file itself, so the order survives `kanbn add`, `kanbn move` and `kanbn validate --save`:

```yaml
columnSorting:
  Backlog:
    - field: workload
      order: descending
    - field: name
      order: ascending
```

You can also write this from the command line:

```bash
kanbn sort "Backlog" --workload -z --name -a --save
```

Running `kanbn sort "Backlog"` **without** `--save` removes any saved sorting settings for that column after applying the sort once.

See `kanbn find --help` and `kanbn sort --help` for the full list of command line options, and [Views](views.md) for filters and sorters inside board views.
