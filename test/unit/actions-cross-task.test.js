const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

/**
 * Create a workspace with an epic and two children, and a set of action rules
 * @param {object[]} rules
 * @param {object} [options={}] Extra index options
 * @return {Promise<Kanbn>}
 */
async function setup(rules, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-for-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Epics',
    columns: ['Backlog', 'In Progress', 'Done'],
    options: {
      startedColumns: ['In Progress'],
      completedColumns: ['Done'],
      actions: rules,
      ...options
    }
  });
  return kanbn;
}

/**
 * Add an epic with two children. Children carry the relation, because adding a child shouldn't mean
 * editing the epic
 * @param {Kanbn} kanbn
 */
async function addEpic(kanbn) {
  await kanbn.createTask({ name: 'Epic One', metadata: { tags: ['epic'] } }, 'Backlog');
  await kanbn.createTask(
    { name: 'Child A', relations: [{ type: 'child-of', task: 'epic-one' }] },
    'Backlog'
  );
  await kanbn.createTask(
    { name: 'Child B', relations: [{ type: 'child-of', task: 'epic-one' }] },
    'Backlog'
  );
  await kanbn.createTask({ name: 'Unrelated' }, 'Backlog');
}

function tags(task) {
  return ('tags' in task.metadata ? task.metadata.tags : []).slice().sort();
}

QUnit.module('cross-task action tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    process.env.KANBN_USER = 'gordon';
  },
  afterEach() {
    delete process.env.KANBN_USER;
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('an incoming selector should act on the tasks that point at this one', async assert => {
  const kanbn = await setup([
    {
      name: 'epic-blocks-children',
      on: 'task.moved',
      when: { tag: 'epic' },
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'parent-moved' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('epic-one', 'In Progress');

  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['parent-moved']);
  assert.deepEqual(tags(await kanbn.getTask('child-b')), ['parent-moved']);
  assert.deepEqual(tags(await kanbn.getTask('unrelated')), []);

  // The verbs went to the children, not to the task the event fired for
  assert.deepEqual(tags(await kanbn.getTask('epic-one')), ['epic']);
});

QUnit.test('an outgoing selector should act on the tasks this one points at', async assert => {
  const kanbn = await setup([
    {
      name: 'tell-the-epic',
      on: 'task.completed',
      for: { related: 'child-of', direction: 'outgoing' },
      then: [{ comment: 'Child @event.task.id is done' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('child-a', 'Done');

  const epic = await kanbn.getTask('epic-one');
  assert.equal(epic.comments.length, 1);
  assert.equal(epic.comments[0].text, 'Child child-a is done');
  assert.equal(epic.comments[0].author, '@kanbn/tell-the-epic');
  assert.equal((await kanbn.getTask('child-b')).comments.length, 0);
});

QUnit.test('a relation type should be matched however it is written', async assert => {
  const kanbn = await setup([
    {
      on: 'task.moved',
      when: { tag: 'epic' },
      for: { related: 'Child Of', direction: 'incoming' },
      then: [{ addTag: 'found' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('epic-one', 'Done');

  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['found']);
});

QUnit.test('an omitted relation type should match any relation', async assert => {
  const kanbn = await setup([
    { on: 'task.moved', when: { tag: 'epic' }, for: { direction: 'incoming' }, then: [{ addTag: 'found' }] }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('epic-one', 'Done');

  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['found']);
  assert.deepEqual(tags(await kanbn.getTask('unrelated')), []);
});

QUnit.test('a where clause should narrow the tasks a rule acts on', async assert => {
  const kanbn = await setup([
    {
      name: 'epic-children-follow',
      on: 'task.moved',
      when: { tag: 'epic', toColumn: 'In Progress' },
      for: { related: 'child-of', direction: 'incoming', where: { 'is-completed': false } },
      then: [{ addTag: 'started-with-parent' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('child-b', 'Done');
  await kanbn.moveTask('epic-one', 'In Progress');

  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['started-with-parent']);
  assert.deepEqual(tags(await kanbn.getTask('child-b')), [], 'a completed child should be left alone');
});

QUnit.test('a cross-task move should move the target and fire nothing', async assert => {
  const kanbn = await setup([
    {
      name: 'pull-children-in',
      on: 'task.moved',
      when: { tag: 'epic', toColumn: 'In Progress' },
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ move: 'In Progress' }]
    },
    { name: 'stamp-started', on: 'task.started', then: [{ addTag: 'started-by-rule' }] }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('epic-one', 'In Progress');

  const index = await kanbn.getIndex();
  assert.deepEqual(index.columns['In Progress'].slice().sort(), ['child-a', 'child-b', 'epic-one']);
  assert.deepEqual(index.columns.Backlog, ['unrelated']);

  // The children moved, but their move fired nothing - not the derived event, not another rule
  const child = await kanbn.getTask('child-a');
  assert.deepEqual(tags(child), []);
  assert.equal(child.history.filter(event => event.type === 'moved').length, 1);
  assert.equal(child.history.find(event => event.type === 'moved').author, '@kanbn/pull-children-in');
});

QUnit.test('a rule acting on the event task and one acting on its relatives should compose', async assert => {
  const kanbn = await setup([
    { name: 'tag-epic', on: 'task.moved', when: { tag: 'epic' }, then: [{ addTag: 'moved' }] },
    {
      name: 'tag-children',
      on: 'task.moved',
      when: { tag: 'epic' },
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'parent-moved' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('epic-one', 'Done');

  assert.deepEqual(tags(await kanbn.getTask('epic-one')), ['epic', 'moved']);
  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['parent-moved']);
});

QUnit.test('two rules acting on the same target should both apply', async assert => {
  const kanbn = await setup([
    {
      name: 'one',
      on: 'task.moved',
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'first' }]
    },
    {
      name: 'two',
      on: 'task.moved',
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'second' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.moveTask('epic-one', 'Done');

  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['first', 'second']);
});

QUnit.test('a relation pointing at nothing should skip with a warning', async assert => {
  const kanbn = await setup([
    {
      name: 'tell-the-epic',
      on: 'task.moved',
      for: { related: 'child-of', direction: 'outgoing' },
      then: [{ addTag: 'x' }]
    }
  ]);
  await kanbn.createTask(
    { name: 'Orphan', relations: [{ type: 'child-of', task: 'nowhere' }] },
    'Backlog'
  );
  await kanbn.moveTask('orphan', 'Done');

  assert.equal(kanbn.lastActionWarnings.length, 1);
  assert.ok(/no task file/.test(kanbn.lastActionWarnings[0]));
});

QUnit.test('task.deleted should act on the tasks that related to the deleted one', async assert => {
  const kanbn = await setup([
    {
      name: 'orphan-children',
      on: 'task.deleted',
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'orphaned' }, { comment: 'Epic @event.task.id was removed' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.deleteTask('epic-one', true);

  const child = await kanbn.getTask('child-a');
  assert.deepEqual(tags(child), ['orphaned']);
  assert.equal(child.comments[0].text, 'Epic epic-one was removed');
});

QUnit.test('archiving should not fire task.deleted', async assert => {
  const kanbn = await setup([
    {
      name: 'orphan-children',
      on: 'task.deleted',
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'orphaned' }]
    },
    {
      name: 'note-archive',
      on: 'task.archived',
      for: { related: 'child-of', direction: 'incoming' },
      then: [{ addTag: 'parent-archived' }]
    }
  ]);
  await addEpic(kanbn);
  await kanbn.archiveTask('epic-one');

  // Archiving removes the task from every board, but that removal is part of the archive rather
  // than a deletion anyone wrote a rule for
  assert.deepEqual(tags(await kanbn.getTask('child-a')), ['parent-archived']);
});

QUnit.module('multi-board action tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    process.env.KANBN_USER = 'gordon';
  },
  afterEach() {
    delete process.env.KANBN_USER;
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

/**
 * Create a workspace with a main board and a design board
 * @param {object} boardOptions Options for each board, keyed by slug
 * @return {Promise<Kanbn>}
 */
async function setupBoards(boardOptions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-boards-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Main',
    columns: ['Backlog', 'In Progress', 'Done'],
    options: boardOptions.index || {}
  });
  await kanbn.board('design').initialise({
    name: 'Design',
    columns: ['Ideas', 'Designing', 'Signed Off'],
    options: boardOptions.design || {}
  });
  return kanbn;
}

QUnit.test('a rule on one board should not fire for operations on another', async assert => {
  const kanbn = await setupBoards({
    design: { actions: [{ on: 'task.moved', then: [{ addTag: 'design-touched' }] }] }
  });
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.board('design').addTaskToBoard('task-1', 'Ideas');

  // Moving on the main board fires nothing, because only the acting board's rules run
  await kanbn.moveTask('task-1', 'Done');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), []);

  await kanbn.board('design').moveTask('task-1', 'Designing');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['design-touched']);
});

QUnit.test('addToBoard should put a task on another board without firing its rules', async assert => {
  const kanbn = await setupBoards({
    index: {
      actions: [
        {
          name: 'send-to-design',
          on: 'task.moved',
          when: { toColumn: 'In Progress', tag: 'design' },
          then: [{ addToBoard: { board: 'design', column: 'Ideas' } }]
        }
      ]
    },
    design: { actions: [{ on: 'task.addedToBoard', then: [{ addTag: 'joined-design' }] }] }
  });
  await kanbn.createTask({ name: 'Task 1', metadata: { tags: ['design'] } }, 'Backlog');
  await kanbn.moveTask('task-1', 'In Progress');

  const designIndex = await kanbn.board('design').getIndex();
  assert.deepEqual(designIndex.columns.Ideas, ['task-1']);

  // The design board's own rule doesn't fire: a rule's writes never produce events
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['design']);

  const task = await kanbn.getTask('task-1');
  const added = task.history.filter(event => event.type === 'added');
  assert.equal(added.length, 1);
  assert.equal(added[0].board, 'design');
  assert.equal(added[0].author, '@kanbn/send-to-design');
});

QUnit.test('an epic joining a board should take its children with it', async assert => {
  const kanbn = await setupBoards({
    index: {
      actions: [
        {
          name: 'epic-children-follow',
          on: 'task.moved',
          when: { tag: 'epic', toColumn: 'In Progress' },
          for: { related: 'child-of', direction: 'incoming', where: { 'is-completed': false } },
          then: [{ addToBoard: { board: 'design', column: 'Ideas' } }]
        }
      ]
    }
  });
  await kanbn.createTask({ name: 'Epic One', metadata: { tags: ['epic'] } }, 'Backlog');
  await kanbn.createTask({ name: 'Child A', relations: [{ type: 'child-of', task: 'epic-one' }] }, 'Backlog');
  await kanbn.createTask({ name: 'Child B', relations: [{ type: 'child-of', task: 'epic-one' }] }, 'Backlog');
  await kanbn.moveTask('epic-one', 'In Progress');

  const designIndex = await kanbn.board('design').getIndex();
  assert.deepEqual(designIndex.columns.Ideas.slice().sort(), ['child-a', 'child-b']);
});

QUnit.test('addToBoard naming a board that does not exist should be a configuration error', async assert => {
  const kanbn = await setupBoards({
    index: {
      actions: [{ on: 'task.moved', then: [{ addToBoard: { board: 'nope', column: 'Ideas' } }] }]
    }
  });
  await assert.throwsAsync(
    async () => {
      await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
    },
    /adds to board "nope", which doesn't exist/
  );
});

QUnit.test('addToBoard naming a column that does not exist should skip with a warning', async assert => {
  const kanbn = await setupBoards({
    index: {
      actions: [{ on: 'task.moved', then: [{ addToBoard: { board: 'design', column: 'Nowhere' } }] }]
    }
  });
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.moveTask('task-1', 'Done');

  assert.equal(kanbn.lastActionWarnings.length, 1);
  assert.ok(/no column "Nowhere"/.test(kanbn.lastActionWarnings[0]));
  assert.deepEqual((await kanbn.board('design').getIndex()).columns.Ideas, []);
});

QUnit.test('a rule on another board should only hear about a workspace-wide event if it opts in', async assert => {
  const kanbn = await setupBoards({
    design: {
      actions: [
        { name: 'listen', on: 'task.archived', anyBoard: true, then: [{ addTag: 'design-knew' }] },
        { name: 'ignore', on: 'task.archived', then: [{ addTag: 'design-missed' }] }
      ]
    }
  });
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.board('design').addTaskToBoard('task-1', 'Ideas');

  // Archived from the main board, so the design board's rules only run if they asked to
  await kanbn.archiveTask('task-1');

  const archived = await kanbn.loadArchivedTask('task-1');
  assert.deepEqual(tags(archived), ['design-knew']);
});

QUnit.test('an anyBoard rule should not fire for a board the task is not on', async assert => {
  const kanbn = await setupBoards({
    design: {
      actions: [{ name: 'listen', on: 'task.archived', anyBoard: true, then: [{ addTag: 'design-knew' }] }]
    }
  });
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.archiveTask('task-1');

  const archived = await kanbn.loadArchivedTask('task-1');
  assert.deepEqual(tags(archived), []);
});

QUnit.test('a broken rule set on another board should be skipped rather than fail the command', async assert => {
  const kanbn = await setupBoards({});
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.board('design').addTaskToBoard('task-1', 'Ideas');

  // Written after the membership exists, because a broken rule fails commands on its own board -
  // the point here is that it doesn't fail commands on someone else's
  const design = kanbn.board('design');
  const designIndex = await design.getIndex();
  designIndex.options.actions = [
    { name: 'broken', on: 'task.archived', anyBoard: true, then: [{ nonsense: true }] }
  ];
  await design.saveIndex(designIndex);

  await kanbn.archiveTask('task-1');

  assert.equal(kanbn.lastActionWarnings.length, 1);
  assert.ok(/skipped board "design" rules/.test(kanbn.lastActionWarnings[0]));
});

QUnit.test('anyBoard with a move should be a configuration error', async assert => {
  const kanbn = await setupBoards({
    index: {
      actions: [{ on: 'task.restored', anyBoard: true, then: [{ move: 'Done' }] }]
    }
  });
  await assert.throwsAsync(
    async () => {
      await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
    },
    /a rule listening from another board names columns/
  );
});

QUnit.test('an anyBoard rule should hear about a restore, which no index can predict', async assert => {
  const kanbn = await setupBoards({
    design: {
      actions: [{ name: 'welcome-back', on: 'task.restored', anyBoard: true, then: [{ addTag: 'design-restored' }] }]
    }
  });
  await kanbn.createTask({ name: 'Task 1' }, 'Backlog');
  await kanbn.board('design').addTaskToBoard('task-1', 'Ideas');
  await kanbn.archiveTask('task-1');

  // At the moment the rules run the task is on no board at all, so the boards it is about to
  // rejoin come from what the archive recorded
  await kanbn.restoreTask('task-1');
  assert.deepEqual(tags(await kanbn.getTask('task-1')), ['design-restored']);
});

QUnit.test('removing a task from one board should not be a workspace-wide event', async assert => {
  const kanbn = await setupBoards({
    design: {
      actions: [
        {
          name: 'note-deletes',
          on: 'task.deleted',
          anyBoard: true,
          for: { related: 'child-of', direction: 'incoming' },
          then: [{ addTag: 'design-noticed' }]
        }
      ]
    }
  });
  for (const epic of ['Epic One', 'Epic Two']) {
    const epicId = epic === 'Epic One' ? 'epic-one' : 'epic-two';
    await kanbn.createTask({ name: epic }, 'Backlog');
    await kanbn.createTask(
      { name: `Child of ${epic}`, relations: [{ type: 'child-of', task: epicId }] },
      'Backlog'
    );
    await kanbn.board('design').addTaskToBoard(epicId, 'Ideas');
  }

  // Removed from the main board only, so the design board still has it and hasn't lost anything
  await kanbn.deleteTask('epic-one');
  assert.deepEqual(tags(await kanbn.getTask('child-of-epic-one')), []);

  // Removed everywhere, which is the case anyBoard is for. Targets are still selected from the
  // acting board, so the design board's rule acts on the main board's tasks
  await kanbn.deleteTask('epic-two', true, true);
  assert.deepEqual(tags(await kanbn.getTask('child-of-epic-two')), ['design-noticed']);
});
