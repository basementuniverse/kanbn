const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

function makeKanbn() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-state-'));
  roots.push(root);
  return new Kanbn(root);
}

async function setup(options = {}) {
  const kanbn = makeKanbn();
  await kanbn.initialise({
    name: 'State Test',
    options: {
      startedColumns: ['In Progress'],
      completedColumns: ['Done'],
      ...options
    },
    columns: ['Todo', 'In Progress', 'Done']
  });
  return kanbn;
}

QUnit.module('task state field tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('should stamp the default fields when no override is configured', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  await kanbn.moveTask(taskId, 'In Progress');
  let task = await kanbn.getTask(taskId);
  assert.true('started' in task.metadata, 'the built-in started field is stamped');

  await kanbn.moveTask(taskId, 'Done');
  task = await kanbn.getTask(taskId);
  assert.true('completed' in task.metadata, 'the built-in completed field is stamped');
});

QUnit.test('should stamp the configured fields instead of the built-in ones', async assert => {
  const kanbn = await setup({
    startedField: 'designStartedAt',
    completedField: 'designSignedOffAt',
    customFields: [
      { name: 'designStartedAt', type: 'date' },
      { name: 'designSignedOffAt', type: 'date' }
    ]
  });
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');

  await kanbn.moveTask(taskId, 'In Progress');
  await kanbn.moveTask(taskId, 'Done');

  const task = await kanbn.getTask(taskId);
  assert.true('designStartedAt' in task.metadata, 'the configured started field is stamped');
  assert.true('designSignedOffAt' in task.metadata, 'the configured completed field is stamped');
  assert.false('started' in task.metadata, 'the shared started field is left alone');
  assert.false('completed' in task.metadata, 'the shared completed field is left alone');
});

QUnit.test('should read completion from the configured field', async assert => {
  const kanbn = await setup({
    completedField: 'designSignedOffAt',
    customFields: [{ name: 'designSignedOffAt', type: 'date' }]
  });

  // A task carrying the shared completed date, which this board does not use
  const taskId = await kanbn.createTask(
    { name: 'Alpha', metadata: { completed: new Date('2026-08-01T09:00:00.000Z') } },
    'Todo'
  );

  const status = await kanbn.status(false);
  assert.false(
    status.taskWorkloads[taskId].completed,
    'another board\'s completed date does not mark the task complete here'
  );

  await kanbn.moveTask(taskId, 'Done');
  const statusAfter = await kanbn.status(false);
  assert.true(
    statusAfter.taskWorkloads[taskId].completed,
    'the board\'s own completed field marks the task complete'
  );
});

QUnit.test('should keep two boards\' state independent on one shared task', async assert => {
  // The same task folder read through two different field configurations, which is what a task
  // shared between two boards will look like
  const kanbn = await setup({
    customFields: [{ name: 'designSignedOffAt', type: 'date' }]
  });
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.moveTask(taskId, 'Done');

  const task = await kanbn.getTask(taskId);
  assert.true('completed' in task.metadata, 'the main board completes the task');
  assert.false('designSignedOffAt' in task.metadata, 'the other board\'s field is untouched');
});

QUnit.test('should not infer completion from column membership', async assert => {
  const kanbn = await setup();

  // Placed directly into a completed column without going through the API, as a hand edit of the
  // index file would do
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), 'Done', ['completed']);

  const status = await kanbn.status(false);
  assert.equal(await kanbn.findTaskColumn(taskId), 'Done', 'the task is in a completed column');
  assert.false(
    status.taskWorkloads[taskId].completed,
    'sitting in a completed column does not make a task complete'
  );
  assert.equal(status.completedTasks, 1, 'the column count still reports what is in the column');
});

QUnit.test('should never report a task as completed without a date', async assert => {
  const kanbn = await setup();
  const taskId = await kanbn.createTask({ name: 'Alpha' }, 'Todo');
  await kanbn.updateTask(taskId, await kanbn.getTask(taskId), 'Done', ['completed']);

  const status = await kanbn.status(false, false, true);
  for (const dueTask of status.dueTasks || []) {
    assert.true(
      !dueTask.completed || dueTask.completedDate !== null,
      'a completed task always has a completed date'
    );
  }
  assert.false(status.taskWorkloads[taskId].completed);
});
