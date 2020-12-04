const mockFileSystem = require('mock-fs');
const kanbn = require('../../lib/main');
const context = require('./context');

QUnit.module('Kanbn library addUntrackedTaskToIndex tests', {
  before() {
    require('./qunit-throws-async');
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

QUnit.test('Add untracked task in un-initialised folder', async assert => {

  // Refresh the filesystem to un-initialise kanbn
  mockFileSystem();

  // Try to add an untracked task without re-initialising kanbn
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-2', 'Test Column');
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Add non-existent untracked task', async assert => {

  // Try to add an untracked task that doesn't exist
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-4', 'Test Column');
    },
    /No task file found with id "test-task-4"/
  );
});

QUnit.test('Add untracked task in non-existent column', async assert => {
  const NON_EXISTENT_COLUMN = 'Wibble';

  // Add an untracked task in a non-existent column
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-2', NON_EXISTENT_COLUMN);
    },
    new RegExp(`Column "${NON_EXISTENT_COLUMN}" doesn't exist`)
  );
});

QUnit.test('Add untracked task that is already indexed', async assert => {

  // Add an untracked task in a non-existent column
  assert.throwsAsync(
    async () => {
      await kanbn.addUntrackedTaskToIndex('test-task-1', 'Test Column');
    },
    /Task "test-task-1" is already in the index/
  );
});

QUnit.test('Add untracked task', async assert => {

  // Add an untracked task
  const TASK_ID = await kanbn.addUntrackedTaskToIndex('test-task-2', 'Test Column');

  // Verify that the task is indexed
  context.indexHasTask(assert, kanbn.getMainFolder(), TASK_ID, 'Test Column');
});
