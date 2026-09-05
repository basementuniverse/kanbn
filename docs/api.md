# Library API

This document is for programs that use `@basementuniverse/kanbn` as a dependency, rather than the `kanbn` CLI. For the file formats that the library
reads and writes, see the [board](index-structure.md) and [task](task-structure.md) structure docs.

## Installation

```bash
npm install @basementuniverse/kanbn
```

## Importing

The package's default export is the CLI entry point (an async function with no return value), used
by the `kanbn` executable. Library consumers should use the named `Kanbn` export instead:

```js
const { Kanbn } = require('@basementuniverse/kanbn');
```

```ts
import { Kanbn } from '@basementuniverse/kanbn';
```

Every method on `Kanbn` is documented with its parameter and return types in the package's shipped
type declarations (`src/main.d.ts`, referenced by the `types` field in `package.json`), so
TypeScript consumers get full IntelliSense without any extra shim.

## Creating an instance

```js
const kanbn = new Kanbn();
```

- The constructor takes an optional `root` (the directory to treat as the current working
  directory, defaulting to `process.cwd()`) and an `options` object: `{ board?: string, caches?:
  any, actions?: boolean }`.
- `options.board` scopes the instance to a secondary board by slug; omit it (or pass `"main"` /
  `"default"`) to target the main board. Use `kanbn.board(slug)` to get a scoped copy of an
  existing instance instead of constructing a new one — this shares config caching.
- `options.actions` defaults to `true`. Pass `false`, or call `kanbn.withoutActions()`, to get an
  instance that never runs [action rules](actions.md) — useful for tooling that shouldn't trigger
  side effects.
- A workspace must be initialised before most methods will work. Check with `initialised()` and
  set one up with `initialise()`:

```js
const kanbn = new Kanbn();
if (!(await kanbn.initialised())) {
  await kanbn.initialise({ name: 'My project' });
}
```

Methods that operate on a workspace throw an `Error` (with a message such as `"Not initialised in
this folder"`) rather than returning an error value, so wrap calls in `try`/`catch` or let promise
rejections propagate.

## Method reference

Methods are grouped by what they operate on. See `src/main.d.ts` for full parameter and return
types, including the shapes of `task`, `index`, `board`, `contributor` and other objects used
below.

### Workspace lifecycle

| Method | Description |
| --- | --- |
| `initialised()` | Whether the current working directory has been initialised |
| `workspaceInitialised()` | Whether the workspace has been initialised, regardless of which board this instance is scoped to |
| `initialise(options?)` | Initialise a kanbn board in the current working directory |
| `getMainFolder()` | The `.kanbn` folder path for the current working directory |
| `removeAll()` | Delete the entire `.kanbn` folder |

### Configuration

| Method | Description |
| --- | --- |
| `configExists()` | Whether a separate config file exists |
| `getConfig()` | Configuration settings from the config file, or `null` if there isn't one |
| `saveConfig(config)` | Save configuration data to a separate config file |
| `clearConfigCache()` | Clear cached config so the next read hits disk again |
| `getWorkspaceOptions()` | Workspace-scoped options, from the config file or the main board's front matter |
| `loadWorkspaceOptions()` | Workspace options along with whether they came from a config file |
| `getFolderName()` / `getIndexFileName()` / `getTaskFolderName()` / `getArchiveFolderName()` | Configured folder and file names |

### Boards

A workspace can have one main board plus any number of secondary boards sharing the same pool of
task files — see [Multiple Boards](multiple-boards.md).

| Method | Description |
| --- | --- |
| `board(slug?)` | Get a copy of this instance scoped to another board (alias: `withBoard(slug?)`) |
| `listBoards()` | Find all boards in the workspace |
| `getBoardsSummary()` | List boards with column/task counts, completion percentage and last modified date |
| `boardExists(slug)` | Whether a board exists |
| `createBoard(slug, options?)` | Create a new secondary board |
| `initialiseBoard(slug, options?)` | Create a secondary board, or update an existing one |
| `deleteBoard(slug)` | Delete a board file; returns ids of tasks that are no longer on any board |
| `renameBoard(slug, newSlug, newName?)` | Rename a board |
| `findOrphanedTasks(slug)` | Tasks that would become untracked if a board were deleted |
| `getCrossBoardTasks(allTasks?)` | Every task that appears on more than one board, with the column it occupies on each |
| `findTaskBoards(taskId)` | Every board that references a task, and the column it occupies on each (alias: `getTaskBoardColumns(taskId)`) |
| `getIndex()` | The index (board) this instance is scoped to, as an object |
| `getBoardsConfig()` | The boards config from the config file: exclude list and display order |

### Tasks

| Method | Description |
| --- | --- |
| `getTask(taskId)` | Get a task as an object |
| `createTask(taskData, columnName)` | Create a task file and add it to the index |
| `updateTask(taskId, taskData, columnName?)` | Update an existing task, optionally moving it |
| `renameTask(taskId, newTaskName)` | Rename a task (changes its id and file name) |
| `moveTask(taskId, columnName, position?, relative?, add?)` | Move a task between columns |
| `deleteTask(taskId, removeFile?, allBoards?)` | Remove a task from the index and optionally delete its file |
| `taskExists(taskId)` | Throws unless the task file exists and is indexed |
| `taskFileExists(taskId)` | Whether a task file exists, regardless of whether any board references it |
| `findTaskColumn(taskId)` | The column a task is in, or throws if it doesn't exist / isn't indexed |
| `findTrackedTasks(columnName?)` | Ids of tasks listed in the index, optionally filtered by column |
| `findUntrackedTasks()` | Ids of markdown files in the tasks folder that aren't listed in the index |
| `addUntrackedTaskToIndex(taskId, columnName)` | Add an untracked task to a column in the index |
| `addTaskToBoard(taskId, columnName)` | Add an existing (already-tracked-elsewhere) task to this board |
| `search(filters?, quiet?)` | Search for indexed tasks matching filters — see [Filtering and Sorting](filtering-and-sorting.md) |
| `sort(columnName, sorters, save?)` | Sort a column using the shared sorter model |
| `comment(taskId, text, author?)` | Add a comment to a task |

### Simple tasks

Simple tasks are plain lines in a column that aren't task links; see [Index Structure](index-structure.md).

| Method | Description |
| --- | --- |
| `findSimpleTasks(input?, index?)` | Simple tasks matching a title, or all of them if no title given |
| `getSimpleTask(input, index?)` | Resolve a title to exactly one simple task, or throw |
| `moveSimpleTask(input, columnName, position?)` | Move a simple task to another column on this board |
| `moveSimpleTaskToBoard(input, targetSlug, columnName?, position?)` | Move a simple task onto another board |
| `deleteSimpleTask(input)` | Remove a simple task |
| `promoteSimpleTask(input, columnName?)` | Turn a simple task into a real task file |

### Archive

| Method | Description |
| --- | --- |
| `listArchivedTasks()` | List archived task ids |
| `archiveTask(taskId)` | Move a task to the archive |
| `restoreTask(taskId, columnName?, singleBoard?)` | Restore a task from the archive |
| `loadArchivedTask(taskId)` | Load an archived task file as an object |

### Contributors

See [Contributors](contributors.md).

| Method | Description |
| --- | --- |
| `getContributors()` | The workspace's contributors, normalised to object form |
| `findContributor(value)` | Find the contributor a name/alias/display-name value refers to |
| `currentUser()` | Work out who the current user is (`KANBN_USER`, then git email/name, then git username, then `null`) |
| `getContributorUsage()` | How contributors are used across tasks, and which names in use aren't known contributors |
| `findContributorWarnings()` | Tasks whose assigned user or comment author isn't a known contributor |

### Actions

See [Actions](actions.md).

| Method | Description |
| --- | --- |
| `withoutActions()` | Get a copy of this instance that runs no action rules |
| `actionsAllowed()` | Whether actions should run at all for this instance |
| `getActionRules(index?)` | The action rules that apply to this board |
| `findActionWarnings()` | Action rules that are legal but probably not what the author meant |
| `lastActionWarnings` | Property: rules that were skipped during the last operation |

### Sprints, status and charts

See [Sprints](sprints.md).

| Method | Description |
| --- | --- |
| `sprint(name, description, start)` | Start a new sprint |
| `status(quiet?, untracked?, due?, sprint?, dates?)` | Project status information |
| `burndown(sprints?, dates?, assigned?, columns?, normalise?)` | Burndown chart data |

### Validation

| Method | Description |
| --- | --- |
| `validate(save?)` | Validate the index and task files; `true` on success, otherwise an array of errors |
| `findMissingTaskFiles(index?)` | Tasks referenced by this board that have no task file |
| `findColumnContentWarnings(index?)` | Lines in this board's columns that aren't task links |
| `findWorkspaceUntrackedTasks()` | Tasks that no board references at all |
| `findTasksOnOtherBoards()` | Tasks that other boards track but this one doesn't |

## Error handling

Kanbn methods reject/throw plain `Error` objects with human-readable messages (for example `"Task
already exists"`, `"Column does not exist"`). There are no custom error classes or machine-readable
error codes to switch on — match on `error.message` if you need to distinguish specific failures.

## A worked example

```js
const { Kanbn } = require('@basementuniverse/kanbn');

async function main() {
  const kanbn = new Kanbn('/path/to/project');

  if (!(await kanbn.initialised())) {
    throw new Error('Not a kanbn project');
  }

  const taskId = await kanbn.createTask(
    { name: 'Write documentation', description: 'Document the library API' },
    'Todo'
  );

  await kanbn.moveTask(taskId, 'In Progress');

  const status = await kanbn.status(false, true);
  console.log(status);
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
```
