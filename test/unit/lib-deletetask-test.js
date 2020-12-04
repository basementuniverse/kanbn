const mockFileSystem = require('mock-fs');
const fs = require('fs');
const kanbn = require('../../lib/main');
const context = require('./context');

QUnit.module('Kanbn library deleteTask tests', {
  before() {
    require('./qunit-throws-async');
  },
  beforeEach() {
    require('./fixtures')({
      columns: 3,
      tasks: 10
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Delete task in un-initialised folder', async assert => {

  // Refresh the filesystem to un-initialise kanbn
  mockFileSystem();

  // Try to delete a task without initialising kanbn
  assert.throwsAsync(
    async () => {
      await kanbn.deleteTask('task-1', {});
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Delete non-existent task', async assert => {

  // Try to delete a non-existent task
  assert.throwsAsync(
    async () => {
      await kanbn.deleteTask('task-11', {});
    },
    /Task "task-11" is not in the index/
  );
});

QUnit.test('Delete an untracked task', async assert => {

  // Create a mock index and untracked task
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1',
      'tasks': {
        'test-task.md': '# Test Task'
      }
    }
  });

  // Try to delete an untracked task
  assert.throwsAsync(
    async () => {
      await kanbn.deleteTask('test-task', {});
    },
    /Task "test-task" is not in the index/
  );
});

QUnit.test('Delete a task from the index but leave the file', async assert => {
  const BASE_PATH = kanbn.getMainFolder();

  // Delete a task and leave the file
  await kanbn.deleteTask('task-1', false);

  // Verify that the task was removed from the index
  context.indexHasTask(assert, BASE_PATH, 'task-1', null, true);

  // Verify that the task file still exists
  context.taskFileExists(assert, BASE_PATH, 'task-1');
});

QUnit.test('Delete a task from the index and remove the file', async assert => {
  const BASE_PATH = kanbn.getMainFolder();

  // Delete a task
  await kanbn.deleteTask('task-1', true);

  // Verify that the task was removed from the index
  context.indexHasTask(assert, BASE_PATH, 'task-1', null, true);

  // Verify that the task file no longer exists
  context.taskFileExists(assert, BASE_PATH, 'task-1', true);
});
