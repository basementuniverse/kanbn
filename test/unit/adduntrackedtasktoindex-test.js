const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('addUntrackedTaskToIndex tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    mockFileSystem({
      '.kanbn': {
        'index.md': '# Test Project\n\n## Test Column\n\n- test-task-1',
        'tasks': {
          'test-task-1.md': '# Test Task 1',
          'test-task-2.md': '# Test Task 2',
          'test-task-3.md': '# Test Task 3'
        }
      }
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Add untracked task in un-initialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-2', 'Test Column');
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Add non-existent untracked task should throw "no task file" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-4', 'Test Column');
    },
    /No task file found with id "test-task-4"/
  );
});

QUnit.test('Add untracked task in non-existent column should throw "no column" error', async assert => {
  const NON_EXISTENT_COLUMN = 'Wibble';
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-2', NON_EXISTENT_COLUMN);
    },
    new RegExp(`Column "${NON_EXISTENT_COLUMN}" doesn't exist`)
  );
});

QUnit.test('Add untracked task that is already indexed should throw "already indexed" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-1', 'Test Column');
    },
    /Task "test-task-1" is already in the index/
  );
});

QUnit.test('Add untracked task to the index', async assert => {
  const TASK_ID = await kanbn.addUntrackedTaskToIndex('test-task-2', 'Test Column');

  // Verify that the task is in the index
  context.indexHasTask(assert, kanbn.getMainFolder(), TASK_ID, 'Test Column');
});
