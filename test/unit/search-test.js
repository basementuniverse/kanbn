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

QUnit.test('Search without filters and quiet option should return all task ids', async assert => {
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
  assert.deepEqual(await kanbn.search({}, true), [
    'task-1',
    'task-2',
    'task-3'
  ]);
});

QUnit.test('Search with id filter', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Test Task'
      },
      {
        name: 'Task Two'
      },
      {
        name: 'Task Three'
      }
    ],
    columns: {
      'Column 1': [
        'test-task',
        'task-two',
        'task-three'
      ]
    }
  });

  // Search using exact match
  let result = await kanbn.search({ id: 'test-task' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'test-task');

  // Search using partial match
  result = await kanbn.search({ id: 'task'});
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(r => r.id), ['test-task', 'task-two', 'task-three']);

  // Search using array match
  result = await kanbn.search({ id: ['two', 'three']});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-two', 'task-three']);

  // Search using regex
  result = await kanbn.search({ id: '^task-(two|three)?'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-two', 'task-three']);
});

QUnit.test('Search with name filter', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Test Task'
      },
      {
        name: 'Task Two'
      },
      {
        name: 'Task Three'
      }
    ],
    columns: {
      'Column 1': [
        'test-task',
        'task-two',
        'task-three'
      ]
    }
  });

  // Search using exact match
  let result = await kanbn.search({ name: 'Test Task' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'test-task');

  // Search using partial match
  result = await kanbn.search({ name: 'task'});
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(r => r.id), ['test-task', 'task-two', 'task-three']);

  // Search using array match
  result = await kanbn.search({ name: ['two', 'three']});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-two', 'task-three']);

  // Search using regex
  result = await kanbn.search({ name: '^task (two|three)?'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-two', 'task-three']);
});

QUnit.test('Search with description filter', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Test Task',
        description: 'Lorem ipsum dolor sit amet'
      },
      {
        name: 'Task Two',
        description: 'Consectetur adipiscing elit'
      },
      {
        name: 'Task Three',
        description: 'Sed do eiusmod tempor incididunt'
      }
    ],
    columns: {
      'Column 1': [
        'test-task',
        'task-two',
        'task-three'
      ]
    }
  });

  // Search using exact match
  let result = await kanbn.search({ description: 'Lorem ipsum dolor sit amet' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'test-task');

  // Search using partial match
  result = await kanbn.search({ description: 'it'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['test-task', 'task-two']);

  // Search using array match
  result = await kanbn.search({ description: ['amet', 'elit']});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['test-task', 'task-two']);

  // Search using regex
  result = await kanbn.search({ description: '(ipsum|adipiscing)'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['test-task', 'task-two']);
});

QUnit.test('Search with column filter', async assert => {
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
      'Test Column': [
        'task-1'
      ],
      'Column One': [
        'task-2'
      ],
      'Column Two': [
        'task-3'
      ]
    }
  });

  // Search using exact match
  let result = await kanbn.search({ column: 'Test Column' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');

  // Search using partial match
  result = await kanbn.search({ column: 'Column'});
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(r => r.id), ['task-1', 'task-2', 'task-3']);

  // Search using array match
  result = await kanbn.search({ column: ['One', 'Two']});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);

  // Search using regex
  result = await kanbn.search({ column: '^Column (One|Two)'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);
});

// TODO search test with created
// TODO search test with updated
// TODO search test with started
// TODO search test with completed
// TODO search test with due
// TODO search test with assigned
// TODO search test with sub-tasks
// TODO search test with count sub-tasks
// TODO search test with tags
// TODO search test with count tags
// TODO search test with relations
// TODO search test with count relations
// TODO search test with comments
// TODO search test with count comments
// TODO search test with custom boolean field
// TODO search test with custom number field
// TODO search test with custom string field
// TODO search test with custom date field
