const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('restore tests', {
  before() {
    require('../qunit-throws-async');
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Restore task in uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  assert.throwsAsync(
    async () => {
      await kanbn.restoreTask('task-1');
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Restore task with no archive folder should throw "no archive folder" error', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column'
    }
  });
  assert.throwsAsync(
    async () => {
      await kanbn.restoreTask('task-1');
    },
    /Archive folder doesn't exist/
  );
});

QUnit.test('Restore non-existing task should throw "archived task not found" error', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column',
      'archive': {}
    }
  });
  assert.throwsAsync(
    async () => {
      await kanbn.restoreTask('task-1');
    },
    /No archived task found with id "task-1"/
  );
});

QUnit.test('Restore task with duplicate indexed task should throw "already indexed" error', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column\n\n- test-task-1',
      'tasks': {
        'test-task-1.md': '# Test Task 1'
      },
      'archive': {
        'test-task-1.md': '# Test Task 1'
      }
    }
  });
  assert.throwsAsync(
    async () => {
      await kanbn.restoreTask('test-task-1');
    },
    /There is already an indexed task with id "test-task-1"/
  );
});

QUnit.test('Restore task with duplicate untracked task should throw "already exists" error', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column',
      'tasks': {
        'test-task-1.md': '# Test Task 1'
      },
      'archive': {
        'test-task-1.md': '# Test Task 1'
      }
    }
  });
  assert.throwsAsync(
    async () => {
      await kanbn.restoreTask('test-task-1');
    },
    /There is already an untracked task with id "test-task-1"/
  );
});

QUnit.test('Restore task with no columns in the index should throw "no columns" error', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project',
      'archive': {
        'test-task-1.md': '# Test Task 1'
      }
    }
  });
  assert.throwsAsync(
    async () => {
      await kanbn.restoreTask('test-task-1');
    },
    /No columns defined in the index/
  );
});

QUnit.test('Restore task to original column', async assert => {
  const BASE_PATH = await kanbn.getMainFolder();
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1\n\n- test-task-1\n\n## Test Column 2',
      'tasks': {
        'test-task-1.md': '# Test Task 1'
      },
      'archive': {
        'test-task-2.md': '# Test Task 2\n\n## Metadata\n\n---\ncolumn: Test Column 2'
      }
    }
  });

  await kanbn.restoreTask('test-task-2');
  context.indexHasTask(assert, BASE_PATH, 'test-task-2', 'Test Column 2');
  context.taskFileExists(assert, BASE_PATH, 'test-task-2');
  context.archivedTaskFileExists(assert, BASE_PATH, 'test-task-2', false);
});

QUnit.test('Restore task to first column', async assert => {
  const BASE_PATH = await kanbn.getMainFolder();
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1\n\n- test-task-1\n\n## Test Column 2',
      'tasks': {
        'test-task-1.md': '# Test Task 1'
      },
      'archive': {
        'test-task-2.md': '# Test Task 2'
      }
    }
  });

  await kanbn.restoreTask('test-task-2');
  context.indexHasTask(assert, BASE_PATH, 'test-task-2', 'Test Column 1');
  context.taskFileExists(assert, BASE_PATH, 'test-task-2');
  context.archivedTaskFileExists(assert, BASE_PATH, 'test-task-2', false);
});

QUnit.test('Restore task to specified column', async assert => {
  const BASE_PATH = await kanbn.getMainFolder();
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1\n\n- test-task-1\n\n## Test Column 2',
      'tasks': {
        'test-task-1.md': '# Test Task 1'
      },
      'archive': {
        'test-task-2.md': '# Test Task 2'
      }
    }
  });

  await kanbn.restoreTask('test-task-2', 'Test Column 2');
  context.indexHasTask(assert, BASE_PATH, 'test-task-2', 'Test Column 2');
  context.taskFileExists(assert, BASE_PATH, 'test-task-2');
  context.archivedTaskFileExists(assert, BASE_PATH, 'test-task-2', false);
});
