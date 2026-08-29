const mockFileSystem = require('../real-fs');
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
  await assert.throwsAsync(
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
      workload: 2,
      progress: 0,
      remainingWorkload: 2
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
      workload: 2,
      progress: 0,
      remainingWorkload: 2
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
      workload: 2,
      progress: 0,
      remainingWorkload: 2
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

QUnit.test('Search with string filter', async assert => {
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

QUnit.test('Search with date filter', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          completed: new Date('01 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          completed: new Date('03 January 2020 12:30:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          completed: new Date('05 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          completed: new Date('07 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 5'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3',
        'task-4',
        'task-5'
      ]
    }
  });

  // Search using single date
  let result = await kanbn.search({ completed: new Date('03 January 2020 12:30:00 GMT') });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-2');

  // Search using array of dates
  result = await kanbn.search({ completed: [
    new Date('02 January 2020 00:00:00 GMT'),
    new Date('06 January 2020 00:00:00 GMT')
  ]});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);
});

QUnit.test('Search with string filter on optional metadata property', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          assigned: 'User 1'
        }
      },
      {
        name: 'Task 2',
        metadata: {
          assigned: 'User 2'
        }
      },
      {
        name: 'Task 3'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3'
      ]
    }
  });

  // Search using exact match
  let result = await kanbn.search({ assigned: 'User 1' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');

  // Search using partial match
  result = await kanbn.search({ assigned: 'User'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-1', 'task-2']);

  // Search using array match
  result = await kanbn.search({ assigned: ['User 1', 'User 2']});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-1', 'task-2']);

  // Search using regex
  result = await kanbn.search({ assigned: '^User [12]'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-1', 'task-2']);
});

QUnit.test('Search with string filter on concatenated property', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        subTasks: [
          {
            completed: true,
            text: 'Sub-task 1'
          }
        ]
      },
      {
        name: 'Task 2',
        subTasks: [
          {
            completed: false,
            text: 'Sub-task 2'
          }
        ]
      },
      {
        name: 'Task 3'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3'
      ]
    }
  });

  // Search using partial match for sub-task name
  let result = await kanbn.search({ 'sub-task': 'Sub-task 1' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');

  // Search using partial match for completed sub-task
  result = await kanbn.search({ 'sub-task': '\\[x\\]'});
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');

  // Search using partial match for uncompleted sub-task
  result = await kanbn.search({ 'sub-task': '\\[ \\]'});
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-2');

  // Search using partial match
  result = await kanbn.search({ 'sub-task': 'Sub-task'});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-1', 'task-2']);
});

QUnit.test('Search with number filter', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        subTasks: [
          {
            completed: false,
            text: 'Sub-task 1'
          }
        ]
      },
      {
        name: 'Task 2',
        subTasks: [
          {
            completed: false,
            text: 'Sub-task 1'
          },
          {
            completed: false,
            text: 'Sub-task 2'
          }
        ]
      },
      {
        name: 'Task 3',
        subTasks: [
          {
            completed: false,
            text: 'Sub-task 1'
          },
          {
            completed: false,
            text: 'Sub-task 2'
          },
          {
            completed: false,
            text: 'Sub-task 3'
          }
        ]
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3'
      ]
    }
  });

  // Search using single number
  let result = await kanbn.search({ 'count-sub-tasks': 3 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-3');

  // Search using array of numbers
  result = await kanbn.search({ 'count-sub-tasks': [2, 4] });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);
});

QUnit.test('Search with string filter on custom field', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          test: 'abc'
        }
      },
      {
        name: 'Task 2',
        metadata: {
          test: 'bcd'
        }
      },
      {
        name: 'Task 3',
        metadata: {
          test: 'cde'
        }
      },
      {
        name: 'Task 4'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3',
        'task-4'
      ]
    },
    options: {
      customFields: [
        {
          name: 'test',
          type: 'string'
        }
      ]
    }
  });
  const result = await kanbn.search({ test: 'cd' });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);
});

QUnit.test('Search with number filter on custom field', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          test: 1
        }
      },
      {
        name: 'Task 2',
        metadata: {
          test: 2
        }
      },
      {
        name: 'Task 3',
        metadata: {
          test: 3
        }
      },
      {
        name: 'Task 4'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3',
        'task-4'
      ]
    },
    options: {
      customFields: [
        {
          name: 'test',
          type: 'number'
        }
      ]
    }
  });

  // Search using single number
  let result = await kanbn.search({ test: 1 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');

  // Search using array of numbers
  result = await kanbn.search({ test: [2, 4] });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);
});

QUnit.test('Search with boolean filter on custom field', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          test: true
        }
      },
      {
        name: 'Task 2',
        metadata: {
          test: false
        }
      },
      {
        name: 'Task 3'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3'
      ]
    },
    options: {
      customFields: [
        {
          name: 'test',
          type: 'boolean'
        }
      ]
    }
  });
  const result = await kanbn.search({ test: true });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');
});

QUnit.test('Search with boolean filter on custom field', async assert => {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          test: new Date('01 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          test: new Date('03 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          test: new Date('05 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4'
      }
    ],
    columns: {
      'Column 1': [
        'task-1',
        'task-2',
        'task-3',
        'task-4'
      ]
    },
    options: {
      customFields: [
        {
          name: 'test',
          type: 'date'
        }
      ]
    }
  });

  // Search using single date
  let result = await kanbn.search({ test: new Date('01 January 2020 00:00:00 GMT') });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'task-1');

  // Search using array of dates
  result = await kanbn.search({ test: [
    new Date('02 January 2020 00:00:00 GMT'),
    new Date('06 January 2020 00:00:00 GMT')
  ]});
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.id), ['task-2', 'task-3']);
});

// Fixture used by the computed value tests below. The started/completed metadata is set explicitly
// rather than by moving tasks, so metadata-based and column-based state can disagree
function computedValueFixtures(options = {}) {
  fixtures({
    noRandom: true,
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          due: new Date('01 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          due: new Date('01 January 2099 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3'
      },
      {
        name: 'Task 4',
        metadata: {
          due: new Date('01 January 2020 00:00:00 GMT'),
          started: new Date('02 January 2020 00:00:00 GMT')
        }
      },
      {
        name: 'Task 5',
        metadata: {
          due: new Date('01 January 2020 00:00:00 GMT'),
          started: new Date('02 January 2020 00:00:00 GMT'),
          completed: new Date('03 January 2020 00:00:00 GMT')
        }
      }
    ],
    columns: {
      'Todo': [
        'task-1',
        'task-2',
        'task-3'
      ],
      'In Progress': [
        'task-4'
      ],
      'Done': [
        'task-5'
      ]
    },
    options: {
      startedColumns: ['In Progress'],
      completedColumns: ['Done'],
      ...options
    }
  });
}

QUnit.test('Search with overdue filter', async assert => {
  computedValueFixtures();

  // Task 1 and task 4 are past their due date and not completed. Task 2 isn't due yet, task 3 has
  // no due date at all, and task 5 is completed
  let result = await kanbn.search({ overdue: true }, true);
  assert.deepEqual(result, ['task-1', 'task-4']);

  result = await kanbn.search({ overdue: false }, true);
  assert.deepEqual(result, ['task-2', 'task-3', 'task-5']);
});

QUnit.test('Search with is-started and is-completed filters', async assert => {
  computedValueFixtures();

  let result = await kanbn.search({ 'is-started': true }, true);
  assert.deepEqual(result, ['task-4', 'task-5']);

  result = await kanbn.search({ 'is-started': false }, true);
  assert.deepEqual(result, ['task-1', 'task-2', 'task-3']);

  result = await kanbn.search({ 'is-completed': true }, true);
  assert.deepEqual(result, ['task-5']);

  result = await kanbn.search({ 'is-completed': false }, true);
  assert.deepEqual(result, ['task-1', 'task-2', 'task-3', 'task-4']);
});

QUnit.test('Search with is-started and is-completed filters should use the configured state fields', async assert => {
  computedValueFixtures({
    startedField: 'designStartedAt',
    completedField: 'designSignedOffAt'
  });

  // No task has the configured fields, so nothing counts as started or completed on this board even
  // though several have the built-in started/completed metadata
  assert.deepEqual(await kanbn.search({ 'is-started': true }, true), []);
  assert.deepEqual(await kanbn.search({ 'is-completed': true }, true), []);
});

QUnit.test('Search with column state filters', async assert => {
  computedValueFixtures();

  let result = await kanbn.search({ 'in-started-column': true }, true);
  assert.deepEqual(result, ['task-4']);

  result = await kanbn.search({ 'in-completed-column': true }, true);
  assert.deepEqual(result, ['task-5']);

  result = await kanbn.search({ 'in-started-column': false, 'in-completed-column': false }, true);
  assert.deepEqual(result, ['task-1', 'task-2', 'task-3']);
});

QUnit.test('Search with column state filters on a board with no started or completed columns', async assert => {
  computedValueFixtures({
    startedColumns: [],
    completedColumns: []
  });

  // A board with no started or completed columns has no notion of either, so no task is in one
  assert.deepEqual(await kanbn.search({ 'in-started-column': true }, true), []);
  assert.deepEqual(await kanbn.search({ 'in-completed-column': true }, true), []);
  assert.deepEqual(
    await kanbn.search({ 'in-started-column': false }, true),
    ['task-1', 'task-2', 'task-3', 'task-4', 'task-5']
  );
});

QUnit.test('Computed value filters should combine with the other filters', async assert => {
  computedValueFixtures();

  const result = await kanbn.search({ overdue: true, column: 'Todo' }, true);
  assert.deepEqual(result, ['task-1']);
});
