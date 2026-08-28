# Contributors

`assigned` and comment `author` are free text, and they always will be. There is no authentication in
Kanbn and there is never going to be any, so it cannot and should not try to prove that a given string
corresponds to a given human — anyone who can edit `.kanbn/tasks/*.md` can write any name they like
into any field.

What Kanbn _can_ do is make the common case — "that's me" — a single keystroke instead of a retyped
name, and make the set of names a workspace uses discoverable rather than folkloric. That is what
`contributors` is for.

**Contributors are a convenience list, not an access control list.** Nothing is validated against
them, nothing is rejected, and nothing in an existing workspace changes when you add them.

## Declaring contributors

`contributors` is a [workspace-scoped option](index-structure.md#project-options): it goes in
`kanbn.yml` / `kanbn.json`, or in the main board's front matter when there is no configuration file,
and every board in the workspace inherits it. A secondary board that declares its own is reported by
`kanbn validate` and ignored — a name written into a shared task file has to mean the same thing on
every board that references that file.

The shorthand is a bare name, which is all most workspaces ever need:

```yaml
contributors:
  - gordon
  - dave
  - sam
```

The long form is for a contributor who needs more than a name. Both forms can appear in the same list:

```yaml
contributors:
  - name: gordon
    displayName: Gordon Larrigan
    email: gordonlarrigan@example.com
    aliases:
      - Gordon Larrigan
      - gordonl
    colour: '#7c5cff'
  - dave
```

| Field | Required | Purpose |
| --- | --- | --- |
| `name` | yes | The canonical value written into `assigned` and comment `author`. Everything else is lookup metadata |
| `displayName` | no | Shown in UIs; never stored in a task file. Defaults to `name` |
| `email` | no | Matched against `git config user.email` |
| `aliases` | no | Other spellings that mean this person |
| `colour` | no | Presentational only, for avatar chips. Kanbn stores and serves it, and never interprets it |

`aliases` is the field that does the actual work. Without it, `contributors` is a list of strings a UI
can put in a dropdown; with it, Kanbn can tell that the person at this machine is `gordon` even though
git says `Gordon Larrigan`.

## The current user

Kanbn resolves a single answer to "who is the current user?", used by the CLI, the library and the
VSCode extension. In order, first match wins:

1. the `KANBN_USER` environment variable, used **exactly as given**
2. `git config user.email` matched against a contributor's `email` → that contributor's `name`
3. `git config user.name` matched against a contributor's `name`, `displayName` or `aliases`,
   ignoring case → that contributor's `name`
4. `git config user.name` as-is
5. nobody

Two things follow from that order:

- **It degrades to what Kanbn has always done.** With no contributors declared, steps 2 and 3 can't
  match and step 4 returns exactly the git username Kanbn used before this feature existed. A
  workspace that ignores contributors sees no change at all.
- **It canonicalises.** With contributors declared, a machine whose git username is `Gordon Larrigan`
  writes `gordon` into the task file, because that is what the workspace has agreed to call him. That
  is the typo mitigation, and it happens without anyone typing anything.

`KANBN_USER` is used verbatim rather than canonicalised: it is the explicit override, for a machine
whose git identity is wrong or missing, and an explicit value should be written exactly as given.

Ask Kanbn who it thinks you are with `kanbn contributors`.

_There is deliberately no `me` key in the config file. A `me` committed into a shared board file would
tell every collaborator that they are you. `KANBN_USER` plus git resolution covers the real cases._

## What uses it

| Where | Behaviour |
| --- | --- |
| `kanbn add --assigned` (no value) | Assigns the task to the current user, canonicalised |
| `kanbn edit "task-id" --assigned` (no value) | The same |
| `kanbn comment "task-id"` | The comment author defaults to the current user, or to no author at all if there isn't one |
| `kanbn add -i` / `kanbn edit -i` | "Assigned to:" becomes an autocomplete over the contributor list when one is declared. Free text is still accepted |
| `kanbn find --assigned @me` | `@me` expands to the current user. Also `kanbn burndown`, `kanbn gantt` and `kanbn history` |
| Task history | Each history event records the current user as its `author`, and no `author` key at all when there is no resolvable user |

`@me` is only ever interpreted in a **filter** argument, never when setting a value and never inside a
task file. If the current user can't be resolved, `@me` is an error rather than a filter that quietly
matches everything.

## Adopting contributors in an existing workspace

`kanbn contributors --usage` shows how each contributor is actually used, and — the useful part —
every name used in a task that isn't a known contributor:

```
$ kanbn contributors --usage
2 contributors:

gordon (you)
  14 tasks, assigned 12, 4 comments
  written as "Gordon Larrigan" in 2 tasks

dave
  6 tasks, assigned 6, 1 comment

1 name is used in tasks but isn't a known contributor:

Gordon
  12 tasks, assigned 12, 0 comments
  task-1, task-4, task-9, ...
```

That is the list of aliases to add. It is read-only: nothing is rewritten, because renaming `Gordon`
to `gordon` across every task file is a bulk mutation that deserves its own command and its own dry
run.

`kanbn validate` reports the same thing more briefly, as a **warning** rather than an error — the
tasks it names are working exactly as they always have. Nothing is reported at all when a workspace
declares no contributors.

## Deliberate omissions

- **Validation.** `assigned` is never restricted to the contributor list. "If contributors is set,
  only allow those values" turns an optional convenience into something that breaks a workspace
  whenever someone adds a task on a machine with a stale config, or renames themselves, or receives a
  task file from outside.
- **Multiple assignees.** `assigned` is a single string in the schema, the filters, the board template
  and three reporting commands. One assignee per task.
- **Importing from `package.json`, `.mailmap` or `CODEOWNERS`.** npm contributors are publishers,
  `.mailmap` is git plumbing, and `CODEOWNERS` is a permissions file — three different sets of
  semantics, none of them this one.
- **Anything resembling accounts.** No permissions, no ownership, no invites. If `contributors` ever
  grows those, it has become an auth system by accident.
