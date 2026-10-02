# Tab Completion

Kanbn can complete its own command lines in bash, zsh and fish: command names, options, and the values that come from your workspace - task ids, column names, board slugs, tags, assignees, sprints and archived tasks.

```
$ kanbn move build-<TAB>
build-email-template-system      -- Backlog
build-invoice-download-endpoint  -- Todo
build-tenant-settings-page       -- In Progress
```

Values are completed from the board the command would actually operate on, so `kanbn move --board design <TAB>` offers the design board's tasks. `KANBN_BOARD` and the [`defaultBoard`](index-structure.md#defaultboard) option are taken into account in the same way.

## Setting it up

`kanbn completion <shell>` prints a script for your shell. Nothing is installed or edited for you.

### bash

Add this to `~/.bashrc`:

```sh
eval "$(kanbn completion bash)"
```

bash leaves out values that would need quoting - in practice, column and board names with spaces in them. zsh and fish complete those properly.

### zsh

Either add this to `~/.zshrc`, **after** `compinit` (before it, it silently does nothing):

```sh
eval "$(kanbn completion zsh)"
```

or save the script as `_kanbn` in a directory on your `$fpath`. This is what plugin managers expect, and it loads the completion only when it's first used:

```sh
kanbn completion zsh > ~/.zsh/completions/_kanbn
```

zsh shows each candidate's column (for tasks) or task count (for columns) beside it.

### fish

```sh
kanbn completion fish > ~/.config/fish/completions/kanbn.fish
```

## What gets completed

| Where | Completes |
| --- | --- |
| The command | Command names. Aliases (`mv`, `rm`, ...) still work, but aren't offered |
| A word starting with `-` | That command's options |
| `task`, `edit`, `move`, `comment`, `archive`, `remove`, `rename` | Task ids on the target board. `edit` also offers [simple tasks](index-structure.md#working-with-simple-tasks), since editing one is how it becomes a task |
| `restore` | Archived task ids |
| `--column`, and `sort`'s column | Column names. [Hidden columns](index-structure.md#hiddencolumns) are offered last, and marked |
| `--board` | Board slugs, apart from any in `boards.exclude` |
| `--tag` | Every tag used by a task |
| `--assigned` | The [contributors](contributors.md) if there are any, otherwise everyone assigned to a task, plus `@me` |
| `--sprint` | Sprint names |

## How it works

The script for each shell is a thin wrapper: it passes the command line to `kanbn __complete`, and turns what that prints into the shell's own completion. All of the logic is in Kanbn, so the three shells behave the same way.

`kanbn __complete` is an internal command. It isn't listed in `kanbn help`, and it isn't a stable interface - but it's simple enough to be useful for building other tools on, so its protocol is described here.

```
kanbn __complete -- <word0> <word1> ... <wordN>
```

`word0` is `kanbn` and `wordN` is the word being completed, which is often empty. Only the words up to and including that one are passed. It prints one candidate per line, as the value, optionally followed by a tab and a description, then a directive line:

```
build-tenant-settings-page	In Progress
create-organization-switcher	Todo
:4
```

The directive is a bitmask. Only `4` - don't fall back to completing file names - is used at present; `1` (an error, offer nothing) and `2` (don't add a space after the completion) are reserved.

It always exits with status 0 and never writes to stderr, even outside a workspace or when a board file can't be parsed: in those cases it prints just the directive. It reads the board files directly rather than loading the Kanbn library, and typically takes a few milliseconds more than Node itself takes to start.
