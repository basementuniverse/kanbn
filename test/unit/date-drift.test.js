const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');
const parseIndex = require('../../src/parse-index');

const roots = [];

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-drift-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Drift Test',
    options: {
      startedColumns: ['In Progress'],
      completedColumns: ['Done']
    },
    columns: ['Todo', 'In Progress', 'Done']
  });
  return kanbn;
}

/**
 * Move a task by rewriting the index directly, the way a hand edit or a merge would - so no dates
 * are stamped
 */
async function moveByHand(kanbn, taskId, toColumn) {
  const index = await kanbn.getIndex();
  for (const column of Object.keys(index.columns)) {
    index.columns[column] = index.columns[column].filter(id => id !== taskId);
  }
  index.columns[toColumn].push(taskId);
  fs.writeFileSync(await kanbn.getIndexPath(), parseIndex.json2md(index));
}

QUnit.module('date drift tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('should report no drift for a board managed through the API', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'In Progress');
  await kanbn.moveTask(taskId, 'Done');

  assert.deepEqual(await kanbn.findDateDrift(), [], 'moving through the API keeps dates in step');
});

QUnit.test('should report a task in a completed column with no completed date', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await moveByHand(kanbn, taskId, 'Done');

  const drift = await kanbn.findDateDrift();
  assert.equal(drift.length, 1);
  assert.equal(drift[0].task, taskId);
  assert.equal(drift[0].field, 'completed');
  assert.equal(drift[0].issue, 'missing');
  assert.true(drift[0].fixable);
});

QUnit.test('should report a task in a started column with no started date', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await moveByHand(kanbn, taskId, 'In Progress');

  const drift = await kanbn.findDateDrift();
  assert.equal(drift.length, 1);
  assert.equal(drift[0].field, 'started');
  assert.equal(drift[0].issue, 'missing');
});

QUnit.test('should backfill from history rather than guessing', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'Done');

  // The move into Done is recorded in history; clear the date it stamped
  const completedDate = (await kanbn.getTask(taskId)).metadata.completed;
  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), null, ['completed']);

  const fixed = await kanbn.fixDateDrift();
  assert.equal(fixed.length, 1);
  assert.equal(fixed[0].source, 'history', 'the date comes from the recorded move');
  assert.equal(
    (await kanbn.getTask(taskId)).metadata.completed.toISOString(),
    completedDate.toISOString(),
    'the restored date matches the original move'
  );
});

QUnit.test('should fall back to the created date when there is no history', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  // Strip history so that only metadata dates remain
  const task = await kanbn.getTask(taskId);
  delete task.history;
  await kanbn.saveTask(path.join(await kanbn.getTaskFolderPath(), `${taskId}.md`), task);
  await moveByHand(kanbn, taskId, 'Done');

  const fixed = await kanbn.fixDateDrift();
  assert.equal(fixed.length, 1);
  assert.true(['created', 'updated'].indexOf(fixed[0].source) !== -1, 'falls back to a metadata date');
  assert.true('completed' in (await kanbn.getTask(taskId)).metadata);
});

QUnit.test('should be idempotent', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await moveByHand(kanbn, taskId, 'Done');

  assert.equal((await kanbn.fixDateDrift()).length, 1, 'the first run fixes the drift');
  assert.equal((await kanbn.fixDateDrift()).length, 0, 'a second run has nothing to do');
  assert.deepEqual(await kanbn.findDateDrift(), []);
});

QUnit.test('should report but not remove a completed date outside a completed column', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'Done');
  await moveByHand(kanbn, taskId, 'Todo');

  const drift = await kanbn.findDateDrift();
  assert.equal(drift.length, 1);
  assert.equal(drift[0].issue, 'unexpected');
  assert.false(drift[0].fixable, 'a real date is never removed automatically');

  await kanbn.fixDateDrift();
  assert.true(
    'completed' in (await kanbn.getTask(taskId)).metadata,
    'the date survives a fix run'
  );
});

QUnit.test('should find drift in tasks that are already loaded', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await moveByHand(kanbn, taskId, 'Done');

  // The board controller uses this form so that showing the hint costs no extra file reads
  const index = await kanbn.getIndex();
  const tasks = await kanbn.loadAllTrackedTasks(index);
  const drift = kanbn.getDateDrift(index, tasks);

  assert.equal(drift.length, 1);
  assert.deepEqual(drift, await kanbn.findDateDrift(), 'both forms agree');
});

QUnit.test('should respect the verbose option', async assert => {
  const kanbn = await setup();
  const index = await kanbn.getIndex();
  assert.true(kanbn.isVerbose(index), 'hints are shown by default');

  index.options.verbose = false;
  assert.false(kanbn.isVerbose(index), 'verbose: false suppresses hints');

  index.options.verbose = true;
  assert.true(kanbn.isVerbose(index));
});
