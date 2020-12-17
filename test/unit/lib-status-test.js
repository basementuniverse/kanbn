const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('Library status tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    require('../fixtures')({
      tasks: [
        {
          name: 'Task 1'
        },
        {
          name: 'Task 2'
        },
        {
          name: 'Task 3'
        },
        {
          name: 'Task 4'
        }
      ],
      columns: {
        'Column 1': [
          'task-1'
        ],
        'Column 2': [
          'task-2'
        ],
        'Column 3': [
          'task-3',
          'task-4'
        ]
      },
      options: {
        startedColumns: ['Column 2'],
        completedColumns: ['Column 3']
      }
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Status in un-initialised folder', async assert => {

  // Refresh the filesystem to un-initialise kanbn
  mockFileSystem();

  // Try to move a task without initialising kanbn
  assert.throwsAsync(
    async () => {
      await kanbn.status();
    },
    /Not initialised in this folder/
  );
});

// TODO finish status tests
