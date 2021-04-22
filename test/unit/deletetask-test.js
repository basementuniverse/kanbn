const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('deleteTask tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    require('../fixtures')({
      countColumns: 3,
      countTasks: 10
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Delete task in uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  assert.throwsAsync(
    async () => {
      await kanbn.deleteTask('task-1', {});
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Delete non-existent task should throw "task not indexed" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.deleteTask('task-11', {});
    },
    /Task "task-11" is not in the index/
  );
});

QUnit.test('Delete an untracked task should throw "task not indexed" error', async assert => {

  // Create untracked task file
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1',
      'tasks': {
        'test-task.md': '# Test Task'
      }
    }
  });
  assert.throwsAsync(
    async () => {
      await kanbn.deleteTask('test-task', {});
    },
    /Task "test-task" is not in the index/
  );
});

QUnit.test('Delete a task from the index but leave the file', async assert => {
  await kanbn.deleteTask('task-1', false);

  // Verify that the task was removed from the index
  const BASE_PATH = await kanbn.getMainFolder();
  context.indexHasTask(assert, BASE_PATH, 'task-1', null, false);

  // Verify that the task file still exists
  context.taskFileExists(assert, BASE_PATH, 'task-1');
});

QUnit.test('Delete a task from the index and remove the file', async assert => {
  await kanbn.deleteTask('task-1', true);

  // Verify that the task was removed from the index
  const BASE_PATH = await kanbn.getMainFolder();
  context.indexHasTask(assert, BASE_PATH, 'task-1', null, false);

  // Verify that the task file no longer exists
  context.taskFileExists(assert, BASE_PATH, 'task-1', false);
});
