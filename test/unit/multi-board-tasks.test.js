const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');
const parseIndex = require('../../src/parse-index');
const parseTask = require('../../src/parse-task');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-multi-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Main Board',
    columns: ['Backlog', 'Todo', 'In Progress', 'Done']
  });
  await kanbn.board('design').initialise({ name: 'Design', columns: ['Ideas', 'Designing', 'Signed Off'] });
  await kanbn.board('ops').initialise({ name: 'Ops', columns: ['Backlog', 'Live'] });
  return kanbn;
}

function boardColumns(kanbn, slug) {
  return kanbn.getMainFolder().then(mainFolder => parseIndex.md2json(
    fs.readFileSync(path.join(mainFolder, slug === 'index' ? 'index.md' : `${slug}.md`), 'utf-8')
  ).columns);
}

function history(taskData) {
  return (taskData.history || []).map(event => ({
    type: event.type,
    board: 'board' in event ? event.board : null
  }));
}

QUnit.module('multi-board task tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('history events should be attributed to the board they happened on', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.board('design').moveTask('shared-task', 'Designing');
  await kanbn.moveTask('shared-task', 'In Progress');

  assert.deepEqual(history(await kanbn.getTask('shared-task')), [
    { type: 'created', board: null },
    { type: 'added', board: 'design' },
    { type: 'moved', board: 'design' },
    { type: 'moved', board: null }
  ], 'main board events carry no board key');
});

QUnit.test('a task created on a secondary board should attribute its created event', async assert => {
  const kanbn = await setup();
  await kanbn.board('design').createTask({ name: 'Design Task' }, 'Ideas');

  assert.deepEqual(history(await kanbn.board('design').getTask('design-task')), [
    { type: 'created', board: 'design' }
  ]);

  // The main board has never heard of it, so asking it for the task is still an error
  await assert.throwsAsync(
    async () => await kanbn.getTask('design-task'),
    /No task with id "design-task" found in the index/
  );
  assert.deepEqual(await kanbn.findTaskBoards('design-task'), { design: 'Ideas' });
});

QUnit.test('removing a task from a board should record it leaving', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  const design = kanbn.board('design');
  await design.addTaskToBoard('shared-task', 'Ideas');

  await design.deleteTask('shared-task');
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), { index: 'Todo' });

  const events = history(await kanbn.getTask('shared-task'));
  assert.deepEqual(events[events.length - 1], { type: 'removed', board: 'design' });
  assert.true(await kanbn.taskFileExists('shared-task'), 'the task file is untouched');
});

QUnit.test('moveTask should add a task to a secondary board it is not on yet', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  const design = kanbn.board('design');

  // Without the add flag this is an error, exactly as moving an unindexed task always has been
  await assert.throwsAsync(
    async () => await design.moveTask('shared-task', 'Designing'),
    /is not in the index/
  );

  await design.moveTask('shared-task', 'Designing', null, false, true);
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), { index: 'Todo', design: 'Designing' });

  // The main board never adds implicitly, whatever the flag says
  await kanbn.createTask({ name: 'Untracked' }, 'Todo');
  await kanbn.deleteTask('untracked');
  await assert.throwsAsync(
    async () => await kanbn.moveTask('untracked', 'Todo', null, false, true),
    /is not in the index/
  );
});

QUnit.test('renameTask should rewrite the id on every board', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.board('ops').addTaskToBoard('shared-task', 'Live');

  assert.equal(await kanbn.renameTask('shared-task', 'Renamed Task'), 'renamed-task');
  assert.deepEqual(await kanbn.findTaskBoards('renamed-task'), {
    index: 'Todo',
    design: 'Ideas',
    ops: 'Live'
  });
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), {});

  // ...including when the rename is run from a secondary board
  await kanbn.board('ops').renameTask('renamed-task', 'Renamed Again');
  assert.deepEqual(Object.keys(await kanbn.findTaskBoards('renamed-again')).sort(), ['design', 'index', 'ops']);
});

QUnit.test('renameTask should refuse an id that another board already uses', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Task One' }, 'Todo');
  await kanbn.board('design').createTask({ name: 'Task Two' }, 'Ideas');

  // The task file is shared, so the existing file is what stops the rename
  await assert.throwsAsync(
    async () => await kanbn.renameTask('task-one', 'Task Two'),
    /A task with id "task-two" already exists/
  );

  // A board referencing an id whose file has gone would otherwise slip past that check
  const mainFolder = await kanbn.getMainFolder();
  fs.unlinkSync(path.join(mainFolder, 'tasks', 'task-two.md'));
  await assert.throwsAsync(
    async () => await kanbn.renameTask('task-one', 'Task Two'),
    /already on board "design"/
  );
});

QUnit.test('deleting a task file should refuse while other boards reference it', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.board('ops').addTaskToBoard('shared-task', 'Live');

  await assert.throwsAsync(
    async () => await kanbn.deleteTask('shared-task', true),
    /is on 2 other boards \(design, ops\)/
  );
  assert.true(await kanbn.taskFileExists('shared-task'));

  // --all-boards removes it everywhere and deletes the file
  await kanbn.deleteTask('shared-task', true, true);
  assert.false(await kanbn.taskFileExists('shared-task'));
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), {});
});

QUnit.test('deleting a task file should be unaffected when it is only on one board', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Only Here' }, 'Todo');

  await kanbn.deleteTask('only-here', true);
  assert.false(await kanbn.taskFileExists('only-here'));
});

QUnit.test('archiving should remember every board and remove the task from all of them', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.board('ops').addTaskToBoard('shared-task', 'Live');

  await kanbn.archiveTask('shared-task');
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), {}, 'archiving clears every board');

  const archived = await kanbn.loadArchivedTask('shared-task');
  assert.equal(archived.metadata.column, 'Todo', 'the main board column is kept as it always was');
  assert.deepEqual(archived.metadata.columns, { index: 'Todo', design: 'Ideas', ops: 'Live' });

  // Restoring puts it back on every board, in the column it came from
  await kanbn.restoreTask('shared-task');
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), {
    index: 'Todo',
    design: 'Ideas',
    ops: 'Live'
  });
  const restored = await kanbn.getTask('shared-task');
  assert.equal('columns' in restored.metadata, false, 'the board map is cleared on restore');
});

QUnit.test('archiving a task on one board should write no columns map', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Only Here' }, 'Todo');

  await kanbn.archiveTask('only-here');
  const archived = await kanbn.loadArchivedTask('only-here');
  assert.equal(archived.metadata.column, 'Todo');
  assert.equal('columns' in archived.metadata, false, 'single-board archives are unchanged');
});

QUnit.test('restoring should skip boards that no longer exist', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.board('ops').addTaskToBoard('shared-task', 'Live');
  await kanbn.archiveTask('shared-task');
  await kanbn.deleteBoard('ops');

  await kanbn.restoreTask('shared-task');
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), { index: 'Todo', design: 'Ideas' });
  assert.deepEqual(kanbn.lastRestoreWarnings, ['ops'], 'the deleted board is reported, not thrown');
});

QUnit.test('restoring with a single board should ignore the remembered boards', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.archiveTask('shared-task');

  await kanbn.board('design').restoreTask('shared-task', 'Designing', true);
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), { design: 'Designing' });
});

QUnit.test('restoring should fall back when the remembered column has gone', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Designing');
  await kanbn.archiveTask('shared-task');

  // Rebuild the design board without the Designing column
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(path.join(mainFolder, 'design.md'), '# Design\n\n## Ideas\n');

  await kanbn.restoreTask('shared-task');
  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), { index: 'Todo', design: 'Ideas' });
});

QUnit.test('a task file with no board keys should behave exactly as it always has', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Plain Task' }, 'Todo');
  await kanbn.moveTask('plain-task', 'In Progress');

  const mainFolder = await kanbn.getMainFolder();
  const taskFile = fs.readFileSync(path.join(mainFolder, 'tasks', 'plain-task.md'), 'utf-8');
  assert.equal(taskFile.includes('board:'), false, 'main board history carries no board key');

  // ...and round-trips unchanged
  const taskData = parseTask.md2json(taskFile);
  assert.equal(parseTask.json2md(taskData), taskFile);
  assert.deepEqual(history(taskData), [
    { type: 'created', board: null },
    { type: 'moved', board: null }
  ]);
});
