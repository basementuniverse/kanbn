const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('archive tests', {
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

QUnit.test('Archive task in uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  assert.throwsAsync(
    async () => {
      await kanbn.archiveTask('task-1');
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Archive non-existent task should throw "task file not found" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.archiveTask('task-2');
    },
    /No task file found with id "task-2"/
  );
});

QUnit.test('Archive untracked task should throw "task not indexed" error', async assert => {

  // Create a mock index and untracked task
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1',
      'tasks': {
        'test-task.md': '# Test Task'
      }
    }
  });

  // Try to archive an untracked task
  assert.throwsAsync(
    async () => {
      await kanbn.archiveTask('test-task');
    },
    /Task "test-task" is not in the index/
  );
});

QUnit.test(
  'Archive task with a duplicate already in the archive should throw "already archived" error',
  async assert => {

    // Create a mock index and untracked task
    mockFileSystem({
      '.kanbn': {
        'index.md': '# Test Project\n\n## Test Column 1\n\n- [test-task](test-task.md)',
        'tasks': {
          'test-task.md': '# Test Task'
        },
        'archive': {
          'test-task.md': '# Test Task'
        }
      }
    });

    // Try to archive a task that has a duplicate in the archive
    assert.throwsAsync(
      async () => {
        await kanbn.archiveTask('test-task');
      },
      /An archived task with id "test-task" already exists/
    );
  }
);

QUnit.test('Archive a task', async assert => {
  const BASE_PATH = await kanbn.getMainFolder();

  await kanbn.archiveTask('task-1');
  context.archiveFolderExists(assert, BASE_PATH);
  context.archivedTaskFileExists(assert, BASE_PATH, 'task-1');
  context.taskFileExists(assert, BASE_PATH, 'task-1', false);
});
