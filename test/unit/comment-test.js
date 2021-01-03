const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('comment tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    require('../fixtures')({
      countColumns: 1,
      countTasks: 1
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Add comment to task in uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  assert.throwsAsync(
    async () => {
      await kanbn.comment('task-1', '', '');
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Add comment to non-existent task should throw "task file not found" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.comment('task-2', '', '');
    },
    /No task file found with id "task-2"/
  );
});

QUnit.test('Add comment to an untracked task should throw "task not indexed" error', async assert => {

  // Create a mock index and untracked task
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1',
      'tasks': {
        'test-task.md': '# Test Task'
      }
    }
  });

  // Try to add a comment to an untracked task
  assert.throwsAsync(
    async () => {
      await kanbn.comment('test-task', '', '');
    },
    /Task "test-task" is not in the index/
  );
});

QUnit.test('Add a comment with blank text throw "blank text" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.comment('task-1', '', '');
    },
    /Comment text cannot be empty/
  );
});

QUnit.test('Add a comment to a task', async assert => {
  const BASE_PATH = kanbn.getMainFolder();
  const TEST_TEXT = 'Test comment...';
  const TEST_AUTHOR = 'Test Author';

  // Get the first task
  let task = await kanbn.getTask('task-1');

  // Add comment to task
  const currentDate = new Date();
  await kanbn.comment('task-1', TEST_TEXT, TEST_AUTHOR);

  // Verify that the task file was updated
  context.taskHasComments(assert, BASE_PATH, 'task-1', [{
    text: TEST_TEXT,
    author: TEST_AUTHOR,
    date: currentDate
  }]);
});
