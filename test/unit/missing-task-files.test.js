const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

const roots = [];

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-missing-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Missing Test',
    columns: ['Todo', 'Done']
  });
  return kanbn;
}

/**
 * Write a column's markdown directly, the way a hand edit or a merge would
 */
async function writeColumn(kanbn, columnName, body) {
  const indexPath = await kanbn.getIndexPath();
  const data = fs.readFileSync(indexPath, { encoding: 'utf-8' });
  fs.writeFileSync(indexPath, data.replace(
    new RegExp(`## ${columnName}\\n[\\s\\S]*?(?=\\n## |$)`),
    `## ${columnName}\n\n${body}\n`
  ));
}

QUnit.module('missing task file tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('loadAllTrackedTasks should skip a task with no task file', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.createTask({ name: 'Beta' }, 'Todo');
  fs.unlinkSync(path.join(await kanbn.getTaskFolderPath(), 'beta.md'));

  const tasks = await kanbn.loadAllTrackedTasks(await kanbn.getIndex());

  assert.deepEqual(tasks.map(task => task.id), ['alpha'], 'the task that exists is still loaded');
});

QUnit.test('loadAllTrackedTasks should still throw for a task file it cannot parse', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  fs.writeFileSync(path.join(await kanbn.getTaskFolderPath(), 'alpha.md'), 'no heading here');

  await assert.throwsAsync(
    async () => {
      await kanbn.loadAllTrackedTasks(await kanbn.getIndex());
    },
    /Unable to parse task/
  );
});

QUnit.test('findMissingTaskFiles should report the task and its column', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.createTask({ name: 'Beta' }, 'Done');
  fs.unlinkSync(path.join(await kanbn.getTaskFolderPath(), 'beta.md'));

  assert.deepEqual(await kanbn.findMissingTaskFiles(), [{ task: 'beta', column: 'Done' }]);
});

QUnit.test('a board with no missing task files should report none', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  assert.deepEqual(await kanbn.findMissingTaskFiles(), []);
});

QUnit.test('sorting a column should not drop a task whose file is missing', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Beta' }, 'Todo');
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  fs.unlinkSync(path.join(await kanbn.getTaskFolderPath(), 'beta.md'));

  await kanbn.sort('Todo', [{ field: 'name', order: 'ascending' }]);

  const index = await kanbn.getIndex();
  assert.deepEqual(index.columns['Todo'].sort(), ['alpha', 'beta'], 'both tasks are still indexed');
});

QUnit.test('status should not fail because of a missing task file', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.createTask({ name: 'Beta' }, 'Todo');
  fs.unlinkSync(path.join(await kanbn.getTaskFolderPath(), 'beta.md'));

  const status = await kanbn.status();

  assert.equal(status.tasks, 2, 'the index still counts both tasks');
  assert.deepEqual(Object.keys(status.taskWorkloads), ['alpha'], 'only loadable tasks are measured');
});

QUnit.test('findColumnContentWarnings should classify each kind of line', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await writeColumn(
    kanbn,
    'Todo',
    '- [alpha](tasks/alpha.md)\n- Buy milk\n- alpha\n- [alpha](tasks/alpha.md'
  );

  const warnings = await kanbn.findColumnContentWarnings();

  assert.deepEqual(
    warnings.map(warning => [warning.type, warning.text]),
    [
      ['non-task-line', 'Buy milk'],
      ['untracked-task-line', 'alpha'],
      ['malformed-task-link', '[alpha](tasks/alpha.md']
    ]
  );
  assert.equal(warnings[0].column, 'Todo');
});

QUnit.test('a checkbox item should not be mistaken for a malformed link', async assert => {
  const kanbn = await setup();
  await writeColumn(kanbn, 'Todo', '- [ ] Buy milk\n- [x] Call Dave');

  const warnings = await kanbn.findColumnContentWarnings();

  assert.deepEqual(warnings.map(warning => warning.type), ['non-task-line', 'non-task-line']);
});

QUnit.test('a board with no extra content should report no warnings', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  assert.deepEqual(await kanbn.findColumnContentWarnings(), []);
});

QUnit.test('content in a column should survive a task being added and moved', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await writeColumn(kanbn, 'Todo', '- [alpha](tasks/alpha.md)\n- Buy milk');

  await kanbn.createTask({ name: 'Beta' }, 'Todo');
  await kanbn.moveTask('alpha', 'Done');

  const index = await kanbn.getIndex();
  assert.deepEqual(
    index.columnContent['Todo'].map(entry => entry.raw),
    ['- Buy milk'],
    'the line stays in the column it was written in'
  );
  assert.deepEqual(index.columns['Todo'], ['beta']);
  assert.deepEqual(index.columns['Done'], ['alpha']);
});
