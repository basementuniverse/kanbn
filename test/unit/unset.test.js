const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

// These tests use a real temporary directory rather than mock-fs, so that they exercise the same
// filesystem code paths the CLI uses
let root = null;
let kanbn = null;

async function setup(options = {}) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-unset-'));
  kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Unset Test',
    options: {
      startedColumns: ['In Progress'],
      completedColumns: ['Done'],
      ...options
    },
    columns: ['Todo', 'In Progress', 'Done']
  });
}

function cleanup() {
  if (root) {
    fs.rmSync(root, { recursive: true, force: true });
    root = null;
  }
}

QUnit.module('updateTask unset tests', {
  before() {
    require('../qunit-throws-async');
  },
  afterEach() {
    cleanup();
  }
});

QUnit.test('should remove a metadata field', async assert => {
  await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'Done');

  let task = await kanbn.getTask(taskId);
  assert.true('completed' in task.metadata, 'moving into a completed column stamps the date');

  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), null, ['completed']);
  task = await kanbn.getTask(taskId);
  assert.false('completed' in task.metadata, 'the completed date is removed');
});

QUnit.test('should remove several metadata fields at once', async assert => {
  await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'In Progress');
  await kanbn.moveTask(taskId, 'Done');

  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), null, ['started', 'completed']);
  const task = await kanbn.getTask(taskId);
  assert.false('started' in task.metadata);
  assert.false('completed' in task.metadata);
  assert.true('created' in task.metadata, 'unrelated metadata is left alone');
});

QUnit.test('should win over the stamp applied by a move in the same update', async assert => {
  await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  // Moving into Done stamps completed; the explicit unset has to be applied after that stamp,
  // otherwise the field comes back
  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), 'Done', ['completed']);

  const task = await kanbn.getTask(taskId);
  assert.equal(await kanbn.findTaskColumn(taskId), 'Done', 'the task still moved');
  assert.false('completed' in task.metadata, 'the explicit unset wins over the automatic stamp');
});

QUnit.test('should remove a custom metadata field', async assert => {
  await setup({
    customFields: [{ name: 'qaSignedOffAt', type: 'date' }]
  });
  const taskId = await kanbn.createTask(
    { name: 'Alpha', metadata: { qaSignedOffAt: new Date('2026-08-01T09:00:00.000Z') } },
    'Todo'
  );

  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), null, ['qaSignedOffAt']);
  const task = await kanbn.getTask(taskId);
  assert.false('qaSignedOffAt' in task.metadata);
});

QUnit.test('should ignore fields that are not set', async assert => {
  await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), null, ['completed', 'due']);
  const task = await kanbn.getTask(taskId);
  assert.false('completed' in task.metadata);
  assert.false('due' in task.metadata);
  assert.true('created' in task.metadata, 'the task is otherwise untouched');
});

QUnit.test('should leave the task unchanged when no fields are unset', async assert => {
  await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'Done');

  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), null);
  const task = await kanbn.getTask(taskId);
  assert.true('completed' in task.metadata, 'an update with no unset list does not clear anything');
});
