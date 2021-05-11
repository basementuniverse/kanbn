const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');

QUnit.module('findUntrackedTasks tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    mockFileSystem({
      '.kanbn': {
        'index.md': '# Test Project\n\n## Test Column 1\n\n- test-task-1\n\n## Test Column 2\n\n- test-task-2',
        'tasks': {
          'test-task-1.md': '# Test Task 1',
          'test-task-2.md': '# Test Task 2',
          'test-task-3.md': '# Test Task 3',
          'test-task-4.md': '# Test Task 4'
        }
      }
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Find untracked tasks in uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  assert.throwsAsync(
    async () => {
      await kanbn.findUntrackedTasks();
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Find untracked tasks should return array of untracked tasks', async assert => {
  assert.deepEqual(
    [...await kanbn.findUntrackedTasks()],
    [
      'test-task-3',
      'test-task-4'
    ]
  );
});
