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
