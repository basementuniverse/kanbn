# Kanbn

A CLI kanban board application.

Documentation can be found [here](./docs/index.md).

Ready-to-run example workspaces live in [`example`](./example) - a [basic board](./example/basic), one demonstrating [views and lanes](./example/views), one demonstrating [multiple boards](./example/boards), and one demonstrating [advanced configuration](./example/advanced).

## Installation

```
npm install -g @basementuniverse/kanbn
```

## Usage

```
Usage:
  kanbn ......... Show help menu
  kanbn <command> [options]

Where <command> is one of:
  help .......... Show help menu
  version ....... Show package version
  init .......... Initialise kanbn board
  board ......... Show the kanbn board
  boards ........ List the boards in this workspace
  task .......... Show a kanbn task
  add ........... Add a kanbn task
  edit .......... Edit a kanbn task
  rename ........ Rename a kanbn task
  move .......... Move a kanbn task to another column
  comment ....... Add a comment to a task
  remove ........ Remove a kanbn task
  find .......... Search for kanbn tasks
  status ........ Get project and task statistics
  sort .......... Sort a column in the index
  sprint ........ Start a new sprint
  burndown ...... View a burndown chart
  gantt ......... Generate and view a Gantt chart
  validate ...... Validate index and task files
  archive ....... Archive a task
  restore ....... Restore a task from the archive
  remove-all .... Remove the kanbn board and all tasks
  history ....... Show task history
  contributors .. List the workspace's contributors
  completion .... Set up tab completion for your shell

For more help with commands, try:

kanbn help <command>
kanbn h <command>
kanbn <command> --help
kanbn <command> -h
```

## Tab completion

Kanbn can complete commands, options, task ids, columns, boards, tags, assignees and sprints in bash, zsh and fish. Load it from your shell's startup file:

```sh
# bash - in ~/.bashrc
eval "$(kanbn completion bash)"

# zsh - in ~/.zshrc, after compinit
eval "$(kanbn completion zsh)"

# fish
kanbn completion fish > ~/.config/fish/completions/kanbn.fish
```

**In zsh the `eval` line must come after `compinit`**, or it does nothing. Alternatively, save the script as `_kanbn` in a directory on your `$fpath`, which also loads it lazily: `kanbn completion zsh > ~/.zsh/completions/_kanbn`. See [tab completion](./docs/completion.md) for more.

## Task ids

Commands that take a task id accept any unique part of one (`kanbn task invoice`), and ask you to pick from a list if you leave it out. See [task ids](./docs/quick-start.md#task-ids).

`kanbn find -q` prints just the ids of the tasks it finds, so it also works with a fuzzy finder such as [fzf](https://github.com/junegunn/fzf):

```
kanbn move "$(kanbn find -q | fzf)" -c Done
```
