const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

const roots = [];

async function setup(columns = ['Todo', 'Doing', 'Done']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-simple-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({ name: 'Simple Test', columns });
  return kanbn;
}

/**
 * Write a column's contents directly, the way a hand edit would
 */
async function writeColumn(kanbn, columnName, body, slug = null) {
  const board = slug === null ? kanbn : kanbn.board(slug);
  const indexPath = slug === null
    ? await kanbn.getIndexPath()
    : await kanbn.getBoardPath(slug);
  const data = fs.readFileSync(indexPath, { encoding: 'utf-8' });
  fs.writeFileSync(indexPath, data.replace(
    new RegExp(`## ${columnName}\\n[\\s\\S]*?(?=\\n## |$)`),
    `## ${columnName}\n\n${body}\n`
  ));
  return board;
}

QUnit.module('simple task tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('findSimpleTasks should list every simple task on the board', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await writeColumn(kanbn, 'Todo', '- [alpha](tasks/alpha.md)\n- Buy milk');
  await writeColumn(kanbn, 'Done', '- Call Dave');

  assert.deepEqual(
    (await kanbn.findSimpleTasks()).map(simpleTask => [simpleTask.text, simpleTask.column]),
    [['Buy milk', 'Todo'], ['Call Dave', 'Done']]
  );
});

QUnit.test('a block of prose should not be a simple task', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk\n\nSome prose about this column');

  assert.deepEqual((await kanbn.findSimpleTasks()).map(simpleTask => simpleTask.text), ['Buy milk']);
});

QUnit.test('findSimpleTasks should match the title exactly, then loosely', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk');

  assert.equal((await kanbn.findSimpleTasks('Buy milk')).length, 1, 'exact');
  assert.equal((await kanbn.findSimpleTasks('buy milk')).length, 1, 'ignoring case');
  assert.equal((await kanbn.findSimpleTasks('buy-milk')).length, 1, 'slugified');
  assert.equal((await kanbn.findSimpleTasks('milk')).length, 0, 'no partial matches');
});

QUnit.test('an exact match should win over a looser one', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk\n- buy milk');

  const matches = await kanbn.findSimpleTasks('Buy milk');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].text, 'Buy milk');
});

QUnit.test('two lines with the same title should be ambiguous', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk');
  await writeColumn(kanbn, 'Done', '- Buy milk');

  await assert.throwsAsync(
    async () => {
      await kanbn.getSimpleTask('Buy milk');
    },
    /matches 2 simple tasks/
  );
});

QUnit.test('moveSimpleTask should move the line to another column', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await writeColumn(kanbn, 'Todo', '- [alpha](tasks/alpha.md)\n- Buy milk');

  const moved = await kanbn.moveSimpleTask('buy-milk', 'Done');

  assert.equal(moved.toColumn, 'Done');
  const index = await kanbn.getIndex();
  assert.notOk('Todo' in (index.columnContent || {}), 'the line has left its old column');
  assert.deepEqual(index.columnContent['Done'].map(entry => entry.raw), ['- Buy milk']);
  assert.deepEqual(index.columns['Todo'], ['alpha'], 'the real task is untouched');
});

QUnit.test('moveSimpleTask should reject a column that does not exist', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk');

  await assert.throwsAsync(
    async () => {
      await kanbn.moveSimpleTask('Buy milk', 'Wibble');
    },
    /Column "Wibble" doesn't exist/
  );
});

QUnit.test('deleteSimpleTask should remove the line and nothing else', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await writeColumn(kanbn, 'Todo', '- [alpha](tasks/alpha.md)\n- Buy milk');

  const removed = await kanbn.deleteSimpleTask('Buy milk');

  assert.equal(removed.text, 'Buy milk');
  const index = await kanbn.getIndex();
  assert.notOk('columnContent' in index, 'the last line leaves no empty structure behind');
  assert.deepEqual(index.columns['Todo'], ['alpha']);
  assert.ok(await kanbn.taskFileExists('alpha'), 'the real task file is untouched');
});

QUnit.test('promoteSimpleTask should create a task file in the same column', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Doing', '- Buy milk');

  const taskId = await kanbn.promoteSimpleTask('Buy milk');

  assert.equal(taskId, 'buy-milk');
  const index = await kanbn.getIndex();
  assert.deepEqual(index.columns['Doing'], ['buy-milk']);
  assert.notOk('columnContent' in index, 'the line is gone');

  const task = await kanbn.getTask('buy-milk');
  assert.equal(task.name, 'Buy milk');
  assert.ok('created' in task.metadata, 'promotion stamps a created date');
  assert.equal(task.history[0].type, 'created');
  assert.equal(task.history[0].column, 'Doing', 'history names the column the line was in');
});

QUnit.test('promoteSimpleTask should be able to target another column', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk');

  await kanbn.promoteSimpleTask('Buy milk', 'Done');

  assert.deepEqual((await kanbn.getIndex()).columns['Done'], ['buy-milk']);
});

QUnit.test('promoteSimpleTask should refuse to clash with an existing task', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Buy milk' }, 'Todo');
  await writeColumn(kanbn, 'Done', '- Buy milk');

  await assert.throwsAsync(
    async () => {
      await kanbn.promoteSimpleTask('Buy milk');
    },
    /A task with id "buy-milk" (already exists|is already in the index)/
  );
  const index = await kanbn.getIndex();
  assert.deepEqual(
    index.columnContent['Done'].map(entry => entry.raw),
    ['- Buy milk'],
    'a promotion that cannot happen leaves the line alone'
  );
});

QUnit.test('moveSimpleTaskToBoard should move the line between board files', async assert => {
  const kanbn = await setup();
  await kanbn.createBoard('design', { name: 'Design', columns: ['Ideas', 'Shipped'] });
  await writeColumn(kanbn, 'Todo', '- Buy milk');

  const moved = await kanbn.moveSimpleTaskToBoard('Buy milk', 'design', 'Ideas');

  assert.equal(moved.toBoard, 'design');
  assert.notOk('columnContent' in (await kanbn.getIndex()), 'the line has left this board');
  assert.deepEqual(
    (await kanbn.board('design').getIndex()).columnContent['Ideas'].map(entry => entry.raw),
    ['- Buy milk']
  );
});

QUnit.test('moveSimpleTaskToBoard should use the first column by default', async assert => {
  const kanbn = await setup();
  await kanbn.createBoard('design', { name: 'Design', columns: ['Ideas', 'Shipped'] });
  await writeColumn(kanbn, 'Todo', '- Buy milk');

  const moved = await kanbn.moveSimpleTaskToBoard('Buy milk', 'design');

  assert.equal(moved.toColumn, 'Ideas');
});

QUnit.test('moveSimpleTaskToBoard should reject a board that does not exist', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- Buy milk');

  await assert.throwsAsync(
    async () => {
      await kanbn.moveSimpleTaskToBoard('Buy milk', 'wibble');
    },
    /Board "wibble" doesn't exist/
  );
});

QUnit.test('the same title on two boards should be two unrelated simple tasks', async assert => {
  const kanbn = await setup();
  await kanbn.createBoard('design', { name: 'Design', columns: ['Ideas'] });
  await writeColumn(kanbn, 'Todo', '- Buy milk');
  await writeColumn(kanbn, 'Ideas', '- Buy milk', 'design');

  assert.equal((await kanbn.findSimpleTasks('Buy milk')).length, 1, 'this board sees only its own');
  assert.equal((await kanbn.board('design').findSimpleTasks('Buy milk')).length, 1);

  await kanbn.deleteSimpleTask('Buy milk');
  assert.equal(
    (await kanbn.board('design').findSimpleTasks('Buy milk')).length,
    1,
    'removing one leaves the other alone'
  );
});
