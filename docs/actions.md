# Actions

An action is a rule that says "when _this_ happens to a task, do _that_". Kanbn has had a single-purpose version of this since the beginning — [`startedColumns` and `completedColumns`](index-structure.md#startedcolumns) stamp a date when a task enters a column, and [custom date fields](index-structure.md#customfields) let you declare more of the same. Actions are that idea generalised: more triggers, and more than one thing you can do.

```yaml
actions:
  - name: start-work
    on: task.moved
    when:
      toColumn: In Progress
    then:
      - assign: '@me'
      - addTag: active
      - removeTag: ready
```

Two properties hold everywhere in this document, and most of the rest follows from them:

- **Actions only fire during commands that change something.** `board`, `status`, `find`, `burndown` and `gantt` never fire an action, so a report is always a pure function of the files on disk. There are no time-based triggers, because Kanbn isn't running when time passes.
- **Actions never fire actions.** Anything a rule writes is written with the rule engine switched off, so a rule can never trigger another rule — or itself. Rules do not chain. If you want two things to happen, write two verbs in one rule.

## Where rules live

`actions` is an ordinary [index option](index-structure.md#project-options), so it layers the way every other option does:

- In `kanbn.yml` / `kanbn.json` / the `kanbn` key in `package.json`, it applies to **every board** in the workspace.
- In a board's front matter — including the main board's — it applies to **that board only**.

A board that declares its own `actions` **replaces** the inherited list rather than adding to it, which is how every other option layers. A board that wants the workspace rules and one of its own has to restate them; [`actionsFile`](#actionsfile) is what makes that bearable.

An operation is scoped to exactly one board, so only that board's rules fire for it — with one deliberate exception, [`anyBoard`](#listening-from-another-board).

## Events

| Event | Fires when | Also carries |
| --- | --- | --- |
| `task.created` | `kanbn add` creates a task | `column` |
| `task.moved` | a task changes column | `fromColumn`, `toColumn` |
| `task.updated` | a task is edited | `changedFields`, `unsetFields` |
| `task.commented` | a comment is added | `comment` |
| `task.addedToBoard` | a task joins this board | `column`, `board` |
| `task.archived` | a task is archived | `fromColumn` |
| `task.restored` | a task is restored from the archive | `toColumn` |
| `task.deleted` | a task is removed from a board | `fromColumn`, `removeFile`, `allBoards` |
| `task.started` | a task becomes started | (whatever the operation carried) |
| `task.completed` | a task becomes completed | (whatever the operation carried) |

Every event also carries `board`, `boardSlug` and `isMainBoard`.

`task.moved` fires only when the column actually changes, matching the rule Kanbn already uses for history events.

### Derived events

`task.started` and `task.completed` aren't operations — they're **transitions**. They fire when the task was not started (or completed) before the operation and is afterwards, whatever caused it: a move into a started column, a `completed` date typed in by hand, a restore into a done column. They read the board's own `startedColumns`, `completedColumns`, `startedField` and `completedField`, so a rule meaning "when this is done" doesn't have to repeat the column list config already holds:

```yaml
# Correct on a board with one completed column, and still correct after you add a second
- on: task.completed
  then:
    - removeTag: active
```

One operation can fire two events — `task.moved` and then `task.completed`. Both sets of rules run, the concrete event first. The transition is evaluated against the state Kanbn is about to write, and before any rule runs, so a rule that writes a `completed` date does **not** fire `task.completed`.

### What can't be an event

There is no daemon, so nothing happens in a Kanbn workspace on its own: due dates passing, sprint boundaries, "no activity for three days" and inbound webhooks are all triggers that need something to be running when time passes, and nothing is. Reporting commands never fire actions either, which is what keeps `kanbn burndown` giving the same answer twice for the same files.

## Conditions

`when` filters the event. It uses the ordinary [filter vocabulary](filtering-and-sorting.md#filter-fields) — every field `kanbn find` accepts, including `tag`, `assigned`, `overdue`, `is-completed` and your own custom fields — plus the event's own keys:

```yaml
- on: task.moved
  when:
    toColumn: [In Progress, Reviewing]   # an event key: matched exactly, a list matches any of them
    tag: epic                            # a task filter: the usual find vocabulary
    overdue: true
  then:
    - addTag: late-start
```

Event keys are matched **exactly**, so a rule written for `Done` doesn't match a column called `Done Later`. Task filters behave exactly as they do in `kanbn find`. A rule with no `when` matches every occurrence of its event.

The task is filtered as it will be *after* the operation, so `when: { toColumn: Done }` and `when: { 'in-completed-column': true }` agree with each other.

## Verbs

`then` is a list of verbs, applied in order. This list is closed, on purpose.

| Verb | Argument | Notes |
| --- | --- | --- |
| `set` | `{ field: value }` | Metadata only. `created` and `updated` are Kanbn's and can't be written |
| `unset` | a field name, or a list of them | |
| `assign` | a name | Shorthand for `set: { assigned: … }` |
| `addTag` / `removeTag` | a tag, or a list of them | `addTag` is idempotent |
| `setProgress` | a number between 0 and 1 | Records a `progress` history event, as a manual change does |
| `comment` | some text | Authored by the rule — see [attribution](#attribution) |
| `move` | a column name, or `{ column, position }` | The only verb that touches the index |
| `addToBoard` | `{ board, column }` | Adds the task to another board |

```yaml
- name: close-out
  on: task.completed
  then:
    - removeTag: active
    - set: { closedBy: '@me', closedIn: '@event.toColumn' }
    - unset: [blocked-by, escalated]
    - setProgress: 1
    - comment: 'Completed by @me'
```

There are no expressions, no arithmetic and no conditionals. `when` is where conditions go, and a rule that needs two conditions is two rules. If you need something this list can't express, Kanbn is a command-line application: write a script that calls it.

### `move`

`move` doesn't perform a second move — it changes the destination of the write that was already about to happen, so "when it enters Review, move it to QA" leaves the task in QA with QA's dates stamped on it:

```yaml
- on: task.moved
  when: { toColumn: Review }
  then:
    - move: QA
```

- A move to the column the task is already in (or already moving to) is a no-op.
- A move to a column that doesn't exist is a configuration error, reported by `kanbn validate`.
- `move` is not available on `task.archived` or `task.deleted`, where the task is leaving the board.

## Substitutions

| Token | Value |
| --- | --- |
| `@me` | The [current user](contributors.md#the-current-user) |
| `@now` | The operation's timestamp |
| `@task.id`, `@task.name` | The task being written |
| `@event.<key>` | Any key the event carries: `@event.toColumn`, `@event.fromColumn`, `@event.column`, `@event.board`, `@event.comment` |
| `@board` | The board the operation ran on |
| `@event.task.id`, `@event.task.name` | The task the event fired for — only different from `@task.*` in a [cross-task rule](#acting-on-related-tasks) |

A value that is nothing but a token keeps that token's type, so `set: { reviewedAt: '@now' }` writes a date rather than a string. A token inside a longer string is interpolated: `comment: 'Moved to @event.toColumn by @me'`.

`@me` can resolve to nothing — a CI container with no `KANBN_USER`, no matching contributor and no git identity has no current user. A verb whose value can't be resolved is **skipped with a warning** rather than writing an empty value, and `kanbn validate` points out rules that use `@me` where no user resolves.

## Acting on related tasks

By default a rule's verbs apply to the task the event fired for. A `for` clause points them at the tasks it is [related](task-structure.md#relations) to instead:

```yaml
- name: epic-children-follow
  on: task.moved
  when: { tag: epic, toColumn: In Progress }
  for:
    related: child-of          # the relation type; omit it to match any relation
    direction: incoming        # incoming: tasks that point at this one. outgoing: tasks it points at
    where: { is-completed: false }   # optional, narrows the set - the usual filter vocabulary
  then:
    - addToBoard: { board: sprint, column: Todo }
```

The division of labour is worth learning once: **`when` decides whether the rule fires, `for` decides who it fires on, and `where` narrows that set.**

Direction matters because Kanbn doesn't maintain inverse relations, and neither will you:

- **`outgoing`** — the tasks named in this task's own `relations` list. This is the child-to-parent direction, given that a child is the natural place to record `child-of`.
- **`incoming`** — the tasks whose `relations` name this task. This is the parent-to-children direction, and it is what makes an epic workable: adding a child doesn't mean editing the epic.

Relation types are matched loosely, so `child-of`, `Child Of` and `child of` are the same type.

Three things to know about the cost and the limits:

- An `incoming` selector has to read every task on the board, which is the same work `kanbn find` does. It happens only when such a rule actually matches, and once per operation however many rules need it. `outgoing` reads only the tasks the relations name.
- A relation pointing at a task that doesn't exist is skipped with a warning, not an error.
- Targets are selected **one hop** away, and their writes fire nothing. So "when a child is done, close the epic if all its siblings are done" is not expressible: that needs a condition over a whole set of tasks, which actions deliberately don't have.

`task.deleted` rules **must** have a `for` clause. Verbs applied to a task that is about to stop
existing are writes to a file about to be removed; acting on the tasks that related to it is the
useful thing to do:

```yaml
- name: orphan-children
  on: task.deleted
  for: { related: child-of, direction: incoming }
  then:
    - removeTag: in-epic
    - comment: 'Epic @event.task.id was removed'
```

## Listening from another board

Archiving, restoring and deleting affect **every** board a task is on, so the board you happened to run the command from is an arbitrary choice of whose rules should fire. By default the acting board's rules are the ones that run — the same way `kanbn restore` already lets the acting board's options drive the dates while every board gets its membership back.

A rule on another board can opt in to hearing about those three events whoever triggered them:

```yaml
# in the design board's front matter
- name: log-archives
  on: task.archived
  anyBoard: true
  then:
    - comment: 'Archived from @event.board'
```

- `anyBoard` is only meaningful on `task.archived`, `task.restored` and `task.deleted`. Setting it on any other event is a configuration error.
- It applies only when the operation really did affect every board. Removing a task from one board (`kanbn remove` without `--all-boards`) is not workspace-wide, so no other board hears about it.
- Rules run in board order, with the acting board's first.
- An `anyBoard` rule can't use `move`, because the columns it names belong to a different board.
- If another board's rules are broken, they're skipped with a warning rather than failing a command that didn't ask for that board. `kanbn validate --all-boards` reports them.

## `actionsFile`

A long rule set makes front matter hard to read, and a board that wants the workspace rules plus one of its own has to restate all of them. `actionsFile` points at a file holding the same list:

```yaml
actionsFile: actions/design.yml    # relative to the .kanbn folder
```

```yaml
# .kanbn/actions/design.yml
- name: tag-on-review
  on: task.moved
  when: { toColumn: Review }
  then:
    - addTag: needs-review
```

- The file contains exactly what the `actions` option would have contained: a list of rules. A file with a top-level `actions:` key is accepted too.
- `actions` and `actionsFile` on the same board is an error — pick one.
- A missing or unparseable `actionsFile` is an error rather than "no rules". A rule set that quietly stops existing is worse than one that fails loudly.

## When something goes wrong

Two kinds of problem, treated differently on purpose:

**Configuration errors** are wrong in the file: an unknown event or verb, a `move` to a column that doesn't exist, a `set` on `created`. `kanbn validate` reports them, and any command that would have run the rules **fails before writing anything**. The whole rule set is checked, not just the rules that would have fired, so a typo shows up the first time you run any command rather than the first time that one rule matches.

**Runtime skips** are things that can only be discovered when the rule fires: `@me` resolving to nothing, a relation pointing at a missing task, `addToBoard` naming a column that has since gone. These print a warning to stderr and the rest of the operation completes.

Nothing fails silently. A rule that quietly stopped working would be worse than no rule at all.

```bash
kanbn validate
kanbn validate --all-boards
```

`kanbn validate` also warns about rule sets that work but probably don't do what they look like — two rules writing the same field on the same event, where the last one silently wins.

## Turning actions off

Every command that can fire an action takes `--no-actions`, and `KANBN_NO_ACTIONS=1` does the same thing for a whole shell:

```bash
kanbn move my-task -c Done --no-actions
KANBN_NO_ACTIONS=1 kanbn add -n "Imported task" -c Backlog
```

This is a way around a misbehaving rule, not a safety control — actions are declarative, so there is nothing being executed to be protected from.

## Attribution

Anything a rule writes is attributed to the rule rather than to a person. A comment written by a rule called `close-out` has the author `@kanbn/close-out`, and so do the history events for a move, a progress change or a board membership that a rule caused:

```yaml
comments:
  - author: '@kanbn/close-out'
    date: 2026-08-29T14:22:05.000Z
    text: Completed by gordon
```

`@me` inside a rule means the human who ran the command, not the rule — both are available at once, which is what lets a rule-written comment say who did it without pretending to be them. [Contributor warnings](contributors.md) ignore `@kanbn/*` authors: a rule is not a missing contributor.

## Interaction with column-linked dates

[Column-linked date fields](index-structure.md#customfields) still work exactly as they did, and they are **not** implemented in terms of actions. Built-in stamping happens first, then rules, so a rule can observe and override a stamped value:

```yaml
customFields:
  - name: testedAt
    type: date
testedAtColumns: [Testing]

actions:
  - on: task.moved
    when: { toColumn: Testing }
    then:
      - assign: '@me'          # runs after testedAt has been stamped
```

A rule that redirects a move with `move` re-stamps for the column the task actually ends up in.

## Full example

```yaml
actions:
  # Tag and assign work as it starts
  - name: start-work
    on: task.started
    then:
      - assign: '@me'
      - addTag: active
      - removeTag: ready

  # Tidy up when it finishes, whatever caused it to finish
  - name: close-out
    on: task.completed
    then:
      - removeTag: active
      - setProgress: 1
      - set: { closedBy: '@me' }

  # Anything entering Review is stamped and flagged
  - name: review-stamp
    on: task.moved
    when: { toColumn: Review }
    then:
      - set: { reviewRequestedAt: '@now' }
      - addTag: needs-review

  # An epic starting pulls its unfinished children onto the sprint board with it
  - name: epic-children-follow
    on: task.moved
    when: { tag: epic, toColumn: In Progress }
    for:
      related: child-of
      direction: incoming
      where: { is-completed: false }
    then:
      - addToBoard: { board: sprint, column: Todo }

  # Removing an epic leaves its children findable
  - name: orphan-children
    on: task.deleted
    for: { related: child-of, direction: incoming }
    then:
      - removeTag: in-epic
      - comment: 'Epic @event.task.id was removed'
```
