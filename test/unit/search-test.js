const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const fixtures = require('../fixtures');

QUnit.module('search tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    mockFileSystem();
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Search in uninitialised folder should throw "not initialised" error', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.search();
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Search without filters should return all tasks', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1'
      },
      {
        name: 'Task 2'
      },
      {
        name: 'Task 3'
      }
    ],
    columns: {
      'Column 1': [
        'task-1'
      ],
      'Column 2': [
        'task-2',
        'task-3'
      ]
    }
  });
  assert.deepEqual(await kanbn.search(), [
    {
      id: 'task-1',
      name: 'Task 1',
      description: '',
      metadata: {},
      subTasks: [],
      relations: [],
      comments: [],
      column: 'Column 1',
      workload: 2
    },
    {
      id: 'task-2',
      name: 'Task 2',
      description: '',
      metadata: {},
      subTasks: [],
      relations: [],
      comments: [],
      column: 'Column 2',
      workload: 2
    },
    {
      id: 'task-3',
      name: 'Task 3',
      description: '',
      metadata: {},
      subTasks: [],
      relations: [],
      comments: [],
      column: 'Column 2',
      workload: 2
    }
  ]);
});

QUnit.test('Search with id filter', async assert => {
  assert.expect(0);
});

// ...

QUnit.test('Search with all filters', async assert => {
  assert.expect(0);
});
