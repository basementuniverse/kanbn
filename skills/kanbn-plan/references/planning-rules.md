# Planning Rules

Use these heuristics when turning a prompt into Kanbn planning artifacts.

## Decomposition Heuristics

- Split by deliverable, decision, integration point, or risk area.
- Prefer tasks that produce one observable planning outcome.
- Separate discovery work from execution work when the unknowns are material.
- Separate prerequisite setup from dependent feature work.
- Separate cross-cutting concerns such as security, observability, migration, or rollout planning when they would otherwise disappear into feature tasks.

## Task Granularity

Aim for tasks that are:

- independently understandable
- narrow enough to estimate or assign later
- broad enough to avoid an explosion of trivial tasks

If a task description needs multiple unrelated deliverables, split it.

## Dependency Rules

- Add dependencies only when order materially matters.
- Prefer `depends-on` over ad hoc wording because Kanbn already understands it for scheduling.
- Use `blocks` when it reads more naturally from the prerequisite task.
- Do not encode the same dependency twice in opposite directions unless the user wants mirrored relations.
- Avoid diamond-shaped dependency graphs when a simpler linear or fan-out structure is more accurate.

## Prioritisation Rules

- Put foundational work before feature-specific work.
- Put architecture and interface decisions before implementation-heavy downstream tasks.
- Put risk-reduction tasks earlier when they can invalidate later work.
- Keep optional enhancements, stretch goals, and nice-to-haves in `Backlog`.

## Naming Rules

- Use explicit outcome-oriented titles.
- Prefer verbs like `Define`, `Plan`, `Document`, `Design`, `Map`, `Specify`, `Assess`, `Prepare`.
- Avoid names that just restate a subsystem with no action.

## Assumption Rules

- Do not invent deadlines, owners, or progress.
- If the prompt leaves a critical planning choice unresolved, capture it as an assumption or an explicit planning task.
- If the board already exists, preserve its conventions unless the user asks to change them.

## Final Review Checklist

Before finalising a generated board, confirm:

- every task in the index has a corresponding task file
- every relation points to an existing task id
- the dependency graph has no cycles
- task descriptions are specific enough to guide later execution
- the board contains planning artifacts only, not implementation work
