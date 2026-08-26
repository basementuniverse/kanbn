const mockFileSystem = require('../real-fs');
const kanbn = require('../../src/main');

QUnit.module('task listing tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    require('../fixtures')({
      countColumns: 3,
      countTasks: 6,
      tasksPerColumn: 2
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Find tracked tasks in an uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  await assert.throwsAsync(
    async () => {
      await kanbn.findTrackedTasks();
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Find tracked tasks should return every indexed task', async assert => {
  const taskIds = [...await kanbn.findTrackedTasks()];

  assert.deepEqual(taskIds.sort(), [
    'task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6'
  ]);
});

QUnit.test('Find tracked tasks in a single column', async assert => {
  const taskIds = [...await kanbn.findTrackedTasks('Column 2')];

  assert.deepEqual(taskIds.sort(), ['task-3', 'task-4']);
});

QUnit.test('List archived tasks in an uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  await assert.throwsAsync(
    async () => {
      await kanbn.listArchivedTasks();
    },
    /Not initialised in this folder/
  );
});

QUnit.test('List archived tasks with no archive folder should throw "no archive folder" error', async assert => {
  await assert.throwsAsync(
    async () => {
      await kanbn.listArchivedTasks();
    },
    /Archive folder doesn't exist/
  );
});

QUnit.test('List archived tasks should return the archived task ids', async assert => {
  await kanbn.archiveTask('task-1');
  await kanbn.archiveTask('task-2');

  const archivedTaskIds = await kanbn.listArchivedTasks();
  assert.deepEqual(archivedTaskIds.sort(), ['task-1', 'task-2']);
});

QUnit.test('List archived tasks with an empty archive should return an empty list', async assert => {
  await kanbn.archiveTask('task-1');
  await kanbn.restoreTask('task-1');

  assert.deepEqual(await kanbn.listArchivedTasks(), []);
});
