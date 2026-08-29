const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');
const actions = require('../../src/actions');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

/**
 * Create a workspace with a set of action rules
 * @param {object[]} rules
 * @param {object} [options={}] Extra index options
 * @return {Promise<Kanbn>}
 */
async function setup(rules, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-actions-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Actions',
    columns: ['Backlog', 'In Progress', 'Done'],
    options: {
      startedColumns: ['In Progress'],
      completedColumns: ['Done'],
      ...(rules === null ? {} : { actions: rules }),
      ...options
    }
  });
  return kanbn;
}

function tags(task) {
  return ('tags' in task.metadata ? task.metadata.tags : []).slice().sort();
}

QUnit.module('actions tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    process.env.KANBN_USER = 'gordon';
  },
  afterEach() {
    delete process.env.KANBN_USER;
    delete process.env.KANBN_NO_ACTIONS;
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('a workspace with no actions option should behave exactly as before', async assert => {
  const kanbn = await setup(null);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'In Progress');

  const task = await kanbn.getTask('task-1');
  assert.deepEqual(tags(task), []);
  assert.equal(task.comments.length, 0);
  assert.deepEqual(kanbn.lastActionWarnings, []);
});

QUnit.test('addTag and removeTag should fire when a task enters a column', async assert => {
  const kanbn = await setup([
    {
      name: 'start-work',
      on: 'task.moved',
      when: { toColumn: 'In Progress' },
      then: [{ addTag: 'active' }, { removeTag: 'ready' }]
    }
  ]);
  await kanbn.createTask({ name: 'Task 1', metadata: { tags: ['ready'] } }, 'Backlog');

  // The rule is written for one column, so a move to any other one leaves the task alone
  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['ready']);

  await kanbn.moveTask('task-1', 'In Progress');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['active']);
});

QUnit.test('an event key filter should match a list of columns and match exactly', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', when: { toColumn: ['In Progress', 'Done'] }, then: [{ addTag: 'touched' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.createTask({ name: 'Task 2' }, 'Backlog');

  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['touched']);

  await kanbn.moveTask('task-2', 'Backlog');
  assert.deepEqual(tags(await kanbn.getTask('task-2')), []);
});

QUnit.test('a when clause should filter on the task as well as the event', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', when: { tag: 'epic' }, then: [{ addTag: 'big' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1', metadata: { tags: ['epic'] } }, 'Backlog');
  await kanbn.createTask({ name: 'Task 2' }, 'Backlog');

  await kanbn.moveTask('task-1', 'Done');
  await kanbn.moveTask('task-2', 'Done');

  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['big', 'epic']);
  assert.deepEqual(tags(await kanbn.getTask('task-2')), []);
});

QUnit.test('task.completed and task.started should fire as transitions', async assert => {
  const kanbn = await setup([
    { on: 'task.started', then: [{ addTag: 'started' }] },
    { on: 'task.completed', then: [{ addTag: 'finished' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');

  await kanbn.moveTask('task-1', 'In Progress');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['started']);

  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['finished', 'started']);
});

QUnit.test('task.completed should fire once, not again on a later move', async assert => {
  const kanbn = await setup([
    { on: 'task.completed', then: [{ setProgress: 1 }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');
  await kanbn.moveTask('task-1', 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  const task = await kanbn.getTask('task-1');
  assert.equal(task.history.filter(event => event.type === 'progress').length, 1);
});

QUnit.test('task.completed should fire when a completed date is set by hand', async assert => {
  const kanbn = await setup([
    { on: 'task.completed', then: [{ addTag: 'finished' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  const task = await kanbn.getTask('task-1');
  task.metadata.completed = new Date();
  await kanbn.updateTask('task-1', task);

  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['finished']);
});

QUnit.test('a task created into a completed column should fire task.completed', async assert => {
  const kanbn = await setup([
    { on: 'task.completed', then: [{ addTag: 'finished' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['finished']);
});

QUnit.test('a rule should never fire another rule', async assert => {
  const kanbn = await setup([
    { name: 'to-progress', on: 'task.moved', when: { toColumn: 'Backlog' }, then: [{ move: 'In Progress' }] },
    { name: 'to-done', on: 'task.moved', when: { toColumn: 'In Progress' }, then: [{ move: 'Done' }] },
    { name: 'stamp', on: 'task.started', then: [{ addTag: 'started-by-rule' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Done');
  await kanbn.moveTask('task-1', 'Backlog');

  // The first rule moves the task to In Progress and nothing else runs: the second rule doesn't
  // see a move it caused, and the derived event doesn't fire for a rule-written column either
  const index = await kanbn.getIndex();
  assert.deepEqual(index.columns['In Progress'], ['task-1']);
  assert.deepEqual(tags(await kanbn.getTask('task-1')), []);
});

QUnit.test('a move verb should redirect the move that was already happening', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', when: { toColumn: 'In Progress' }, then: [{ move: { column: 'Done' } }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'In Progress');

  const index = await kanbn.getIndex();
  assert.deepEqual(index.columns.Done, ['task-1']);
  assert.deepEqual(index.columns['In Progress'], []);

  // The redirected column is stamped, so the task's dates match where it actually ended up
  const task = await kanbn.getTask('task-1');
  assert.ok('completed' in task.metadata, 'should have a completed date from the column it landed in');
  assert.deepEqual(
    task.history.filter(event => event.type === 'moved').map(event => event.toColumn),
    ['In Progress', 'Done']
  );
});

QUnit.test('a move to the column the task is already in should be a no-op', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', when: { toColumn: 'Done' }, then: [{ move: 'Done' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  const task = await kanbn.getTask('task-1');
  assert.equal(task.history.filter(event => event.type === 'moved').length, 1);
});

QUnit.test('set, unset, assign, setProgress and comment should all write', async assert => {
  const kanbn = await setup([
    {
      name: 'close-out',
      on: 'task.completed',
      then: [
        { set: { closedBy: '@me', closedIn: '@event.toColumn' } },
        { unset: 'due' },
        { assign: '@me' },
        { setProgress: 1 },
        { comment: 'Closed by @me on board @board' }
      ]
    }
  ]);
  await kanbn.createTask({ name: 'Task 1', metadata: { due: new Date() } }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  const task = await kanbn.getTask('task-1');
  assert.equal(task.metadata.closedBy, 'gordon');
  assert.equal(task.metadata.closedIn, 'Done');
  assert.notOk('due' in task.metadata, 'due should have been unset');
  assert.equal(task.metadata.assigned, 'gordon');
  assert.equal(task.metadata.progress, 1);
  assert.equal(task.comments.length, 1);
  assert.equal(task.comments[0].text, 'Closed by gordon on board index');
});

QUnit.test('@now should write a date rather than a string', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', then: [{ set: { reviewedAt: '@now' } }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  const task = await kanbn.getTask('task-1');
  assert.ok(task.metadata.reviewedAt instanceof Date, 'reviewedAt should be a date');
});

QUnit.test('anything a rule writes should be attributed to the rule', async assert => {
  const kanbn = await setup([
    { name: 'close-out', on: 'task.completed', then: [{ comment: 'done' }, { setProgress: 1 }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  const task = await kanbn.getTask('task-1');
  assert.equal(task.comments[0].author, '@kanbn/close-out');
  assert.equal(task.history.find(event => event.type === 'progress').author, '@kanbn/close-out');
});

QUnit.test('an unresolvable @me should skip the verb with a warning', async assert => {
  const kanbn = await setup([
    { name: 'assign-me', on: 'task.moved', then: [{ assign: '@me' }, { addTag: 'moved' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');

  // No KANBN_USER, and currentUser() is stubbed to find nothing else either
  delete process.env.KANBN_USER;
  kanbn.currentUser = async () => null;
  await kanbn.moveTask('task-1', 'Done');

  const task = await kanbn.getTask('task-1');
  assert.notOk('assigned' in task.metadata, 'assigned should not have been written');
  assert.deepEqual(tags(task), ['moved'], 'the rest of the rule should still run');
  assert.equal(kanbn.lastActionWarnings.length, 1);
  assert.ok(/@me/.test(kanbn.lastActionWarnings[0]), 'the warning should name the substitution');
});

QUnit.test('a configuration error should fail the operation before anything is written', async assert => {
  const kanbn = await setup(null);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  const before = await kanbn.getTask('task-1');

  // Installed after the task exists, because the whole rule set is checked on every operation - a
  // typo is reported the first time any command runs, not the first time that one rule would fire
  const withRule = await kanbn.getIndex();
  withRule.options.actions = [{ name: 'broken', on: 'task.moved', then: [{ notAVerb: 'x' }] }];
  await kanbn.saveIndex(withRule);

  await assert.throwsAsync(
    async () => {
      await kanbn.moveTask('task-1', 'Done');
    },
    /uses unknown verb "notAVerb"/
  );

  const index = await kanbn.getIndex();
  assert.deepEqual(index.columns.Backlog, ['task-1'], 'the task should not have moved');
  const after = await kanbn.getTask('task-1');
  assert.deepEqual(after.metadata, before.metadata, 'the task file should be untouched');
});

QUnit.test('a move to a column that does not exist should fail the operation', async assert => {
  const kanbn = await setup([
    { name: 'send-to-qa', on: 'task.moved', then: [{ move: 'QA' }] }
  ]);
  await assert.throwsAsync(
    async () => {
      await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
    },
    /moves to column "QA", which doesn't exist on this board/
  );
});

QUnit.test('a move to a substituted column should skip with a warning if it resolves to nothing', async assert => {
  // A column that comes from a substitution can't be checked until the rule fires, so this is the
  // one way a move becomes a runtime skip rather than a configuration error
  const kanbn = await setup([
    { name: 'send-somewhere', on: 'task.moved', then: [{ move: { column: '@task.name' } }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'In Progress');

  assert.equal(kanbn.lastActionWarnings.length, 1);
  assert.ok(/doesn't exist on this board/.test(kanbn.lastActionWarnings[0]));
  assert.deepEqual((await kanbn.getIndex()).columns['In Progress'], ['task-1']);
});

QUnit.test('actions should not fire when they are disabled', async assert => {
  const rules = [{ on: 'task.moved', then: [{ addTag: 'active' }] }];
  const kanbn = await setup(rules);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');

  kanbn.actionsEnabled = false;
  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), []);

  kanbn.actionsEnabled = true;
  process.env.KANBN_NO_ACTIONS = '1';
  await kanbn.moveTask('task-1', 'Backlog');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), []);

  delete process.env.KANBN_NO_ACTIONS;
  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['active']);
});

QUnit.test('reading a board should never fire actions', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', then: [{ addTag: 'active' }] },
    { on: 'task.updated', then: [{ addTag: 'active' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');

  await kanbn.search({});
  await kanbn.status(true);
  await kanbn.getIndex();

  assert.deepEqual(tags(await kanbn.getTask('task-1')), []);
});

QUnit.test('commenting should fire task.commented', async assert => {
  const kanbn = await setup([
    { on: 'task.commented', then: [{ addTag: 'discussed' }, { set: { lastComment: '@event.comment' } }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.comment('task-1', 'what about this?', 'gordon');

  const task = await kanbn.getTask('task-1');
  assert.deepEqual(tags(task), ['discussed']);
  assert.equal(task.metadata.lastComment, 'what about this?');
});

QUnit.test('updating a task should fire task.updated with the fields that changed', async assert => {
  const kanbn = await setup([
    { on: 'task.updated', when: { changedFields: 'assigned' }, then: [{ addTag: 'reassigned' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');

  const task = await kanbn.getTask('task-1');
  task.description = 'a new description';
  await kanbn.updateTask('task-1', task);
  assert.deepEqual(tags(await kanbn.getTask('task-1')), []);

  const updated = await kanbn.getTask('task-1');
  updated.metadata.assigned = 'someone';
  await kanbn.updateTask('task-1', updated);
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['reassigned']);
});

QUnit.test('archiving and restoring should fire their events', async assert => {
  const kanbn = await setup([
    { on: 'task.archived', then: [{ addTag: 'archived' }, { set: { archivedFrom: '@event.fromColumn' } }] },
    { on: 'task.restored', then: [{ removeTag: 'archived' }, { addTag: 'restored' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.archiveTask('task-1');

  const archived = await kanbn.loadArchivedTask('task-1');
  assert.deepEqual(tags(archived), ['archived']);
  assert.equal(archived.metadata.archivedFrom, 'Backlog');

  await kanbn.restoreTask('task-1');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['restored']);
});

QUnit.test('an actionsFile should hold the same rules as the option', async assert => {
  const kanbn = await setup(null, { actionsFile: 'actions.yml' });
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(
    path.join(mainFolder, 'actions.yml'),
    '- name: tag-on-move\n  on: task.moved\n  then:\n    - addTag: active\n'
  );

  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['active']);
});

QUnit.test('actions and actionsFile together should be an error', async assert => {
  const kanbn = await setup([{ on: 'task.moved', then: [{ addTag: 'active' }] }], {
    actionsFile: 'actions.yml'
  });
  await assert.throwsAsync(
    async () => {
      await kanbn.getActionRules();
    },
    /can't both be set/
  );
});

QUnit.test('a missing actionsFile should be an error rather than no rules', async assert => {
  const kanbn = await setup(null, { actionsFile: 'nope.yml' });
  await assert.throwsAsync(
    async () => {
      await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
    },
    /actionsFile "nope.yml" doesn't exist/
  );
});

QUnit.test('validate should report configuration errors in rules', async assert => {
  const kanbn = await setup([
    { name: 'broken', on: 'task.nope', then: [{ set: { created: '@now' } }] }
  ]);
  const result = await kanbn.validate();
  assert.notEqual(result, true, 'validate should report errors');
  const messages = result.map(error => error.errors).join('\n');
  assert.ok(/unknown event "task.nope"/.test(messages));
  assert.ok(/sets "created", which Kanbn manages/.test(messages));
});

QUnit.test('validate should report two rules writing the same field as a warning', async assert => {
  const kanbn = await setup([
    { name: 'one', on: 'task.moved', then: [{ assign: 'a' }] },
    { name: 'two', on: 'task.moved', then: [{ assign: 'b' }] }
  ]);
  assert.equal(await kanbn.validate(), true, 'the rules themselves are valid');

  const warnings = await kanbn.findActionWarnings();
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, 'conflicting-actions');
  assert.ok(/rule "one" and rule "two"/.test(warnings[0].message));
});

QUnit.test('a comment written by a rule should not be an unknown contributor', async assert => {
  const kanbn = await setup([{ name: 'note', on: 'task.moved', then: [{ comment: 'moved' }] }], {
    contributors: ['gordon']
  });
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  assert.deepEqual(await kanbn.findContributorWarnings(), []);
});

QUnit.module('actions rule checking tests');

QUnit.test('findRuleErrors should catch the ways a rule can be wrong', async assert => {
  const check = (rule, context = {}) =>
    actions.findRuleErrors(actions.normaliseRules([rule]), context).join('\n');

  assert.ok(/has no "on" event/.test(check({ then: [{ addTag: 'x' }] })));
  assert.ok(/has no "then" verbs/.test(check({ on: 'task.moved' })));
  assert.ok(/unknown event/.test(check({ on: 'task.exploded', then: [{ addTag: 'x' }] })));
  assert.ok(/unknown verb/.test(check({ on: 'task.moved', then: [{ explode: true }] })));
  assert.ok(
    /each verb is a single key/.test(check({ on: 'task.moved', then: [{ addTag: 'x', removeTag: 'y' }] }))
  );
  assert.ok(/which Kanbn doesn't support/.test(check({ on: 'task.moved', run: 'x.js', then: [] })));
  assert.ok(
    /doesn't exist on this board/.test(
      check({ on: 'task.moved', then: [{ move: 'Nowhere' }] }, { columns: ['Backlog'] })
    )
  );
  assert.ok(
    /which task.moved doesn't carry/.test(check({ on: 'task.moved', then: [{ addTag: '@event.removeFile' }] }))
  );
  assert.ok(
    /unknown substitution/.test(check({ on: 'task.moved', then: [{ addTag: '@nonsense' }] }))
  );
  assert.ok(
    /filters on "column", which task.moved doesn't carry/.test(
      check({ on: 'task.moved', when: { column: 'Done' }, then: [{ addTag: 'x' }] })
    )
  );
  assert.ok(
    /has to act on related tasks/.test(check({ on: 'task.deleted', then: [{ addTag: 'x' }] }))
  );
  assert.ok(
    /the task is leaving the board/.test(check({ on: 'task.archived', then: [{ move: 'Done' }] }))
  );
  assert.ok(
    /only task.archived, task.restored, task.deleted/.test(
      check({ on: 'task.moved', anyBoard: true, then: [{ addTag: 'x' }] })
    )
  );
  assert.ok(/unknown "for.direction"/.test(
    check({ on: 'task.moved', for: { direction: 'sideways' }, then: [{ addTag: 'x' }] })
  ));
  assert.ok(/has an unknown key "wen"/.test(
    check({ on: 'task.moved', wen: {}, then: [{ addTag: 'x' }] })
  ));

  // A valid rule should produce nothing at all
  assert.equal(
    check(
      {
        name: 'ok',
        on: 'task.moved',
        when: { toColumn: 'Done', tag: 'epic' },
        for: { related: 'child-of', direction: 'incoming', where: { 'is-completed': false } },
        then: [{ addTag: 'x' }, { comment: '@task.name moved by @me at @now' }]
      },
      { columns: ['Backlog', 'Done'] }
    ),
    ''
  );
});

QUnit.test('substitute should keep the type of a whole-value token', async assert => {
  const date = new Date();
  const unresolved = [];
  assert.equal(actions.substitute('@now', { '@now': date }, unresolved), date);
  assert.equal(actions.substitute('at @now', { '@now': date }, unresolved), `at ${date.toISOString()}`);
  assert.deepEqual(unresolved, []);

  assert.equal(actions.substitute('@me', {}, unresolved), undefined);
  assert.deepEqual(unresolved, ['@me']);
});

QUnit.test('parseActionsFile should accept a list or an object with an actions key', async assert => {
  assert.deepEqual(actions.parseActionsFile('', 'a.yml'), []);
  assert.equal(actions.parseActionsFile('- on: task.moved\n  then: []\n', 'a.yml').length, 1);
  assert.equal(
    actions.parseActionsFile('actions:\n  - on: task.moved\n    then: []\n', 'a.yml').length,
    1
  );
  assert.throws(
    () => actions.parseActionsFile('just a string', 'a.yml'),
    /must contain a list of rules/
  );
});

QUnit.test('a rule on task.created should see the task id and column', async assert => {
  const kanbn = await setup([
    {
      name: 'stamp-new',
      on: 'task.created',
      when: { column: 'Backlog' },
      then: [{ set: { origin: '@event.column' } }, { comment: 'Created @task.id' }]
    }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.createTask({ name: 'Task 2' }, 'Done');

  const task = await kanbn.getTask('task-1');
  assert.equal(task.metadata.origin, 'Backlog');
  assert.equal(task.comments[0].text, 'Created task-1');
  assert.equal((await kanbn.getTask('task-2')).comments.length, 0);
});

QUnit.test('a task filter on task.created should see the column the task is created in', async assert => {
  const kanbn = await setup([
    { on: 'task.created', when: { 'in-completed-column': true }, then: [{ addTag: 'born-done' }] }
  ]);
  await kanbn.createTask({ name: 'Task 1' }, 'Done');
  await kanbn.createTask({ name: 'Task 2' }, 'Backlog');

  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['born-done']);
  assert.deepEqual(tags(await kanbn.getTask('task-2')), []);
});
