const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');
const fixtures = require('../fixtures');
const mockDate = require('mockdate');

QUnit.module('status tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    mockFileSystem();
    mockDate.set('02 Jan 2000 00:00:00 GMT');
  },
  afterEach() {
    mockFileSystem.restore();
    mockDate.reset();
  }
});

QUnit.test('Status in un-initialised folder', async assert => {

  // Get status without initialising kanbn
  assert.throwsAsync(
    async () => {
      await kanbn.status();
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Status untracked and quiet, no untracked tasks', async assert => {

  // Initialise kanbn
  await kanbn.initialise();

  // Get status with untracked and quiet options
  assert.equal(await kanbn.status(true, true), 'No untracked tasks found');
});

QUnit.test('Status untracked and quiet', async assert => {

  // Add some untracked files
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        untracked: true
      },
      {
        name: 'Task 2',
        untracked: true
      },
      {
        name: 'Task 3',
        untracked: true
      }
    ]
  });
  assert.deepEqual(await kanbn.status(true, true), [
    'task-1.md',
    'task-2.md',
    'task-3.md'
  ]);
});

QUnit.test('Status quiet', async assert => {

  // Initialise and add some tasks
  fixtures({
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
    }
  });
  assert.deepEqual(await kanbn.status(true), {
    tasks: 4,
    columnTasks: {
      'Column 1': 1,
      'Column 2': 1,
      'Column 3': 2
    }
  });
});

QUnit.test('Status non-quiet', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          assigned: 'User 1'
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium', 'Tiny'],
          assigned: 'User 1'
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          assigned: 'User 2'
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          assigned: 'User 2'
        }
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
    }
  });
  assert.deepEqual(await kanbn.status(), {
    tasks: 4,
    columnTasks: {
      'Column 1': 1,
      'Column 2': 1,
      'Column 3': 2
    },
    totalWorkload: 19,
    columnWorkloads: {
      'Column 1': 2,
      'Column 2': 4,
      'Column 3': 13
    },
    taskWorkloads: {
      'task-1': 2,
      'task-2': 4,
      'task-3': 5,
      'task-4': 8
    },
    assigned: {
      'User 1': {
        total: 2,
        workload: 6
      },
      'User 2': {
        total: 2,
        workload: 13
      }
    }
  });
});

QUnit.test('Status non-quiet with due data', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          assigned: 'User 1',
          due: new Date('01 Jan 2000 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium', 'Tiny'],
          assigned: 'User 1',
          due: new Date('03 Jan 2000 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          assigned: 'User 2',
          due: new Date('01 Jan 2000 22:30:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          assigned: 'User 2'
        }
      },
      {
        name: 'Task 5',
        metadata: {
          tags: ['Tiny'],
          assigned: 'User 1',
          due: new Date('01 Jan 2000 22:30:00 GMT'),
          completed: new Date('01 Jan 2000 22:00:00 GMT')
        }
      },
      {
        name: 'Task 6',
        metadata: {
          tags: ['Small'],
          assigned: 'User 1',
          due: new Date('02 Jan 2000 02:00:00 GMT')
        }
      }
    ],
    columns: {
      'Column 1': [
        'task-1'
      ],
      'Column 2': [
        'task-2',
        'task-5'
      ],
      'Column 3': [
        'task-3',
        'task-4',
        'task-6'
      ]
    },
    options: {
      completedColumns: [
        'Column 3'
      ]
    }
  });
  assert.deepEqual(await kanbn.status(false, false, true), {
    tasks: 6,
    columnTasks: {
      'Column 1': 1,
      'Column 2': 2,
      'Column 3': 3
    },
    totalWorkload: 22,
    columnWorkloads: {
      'Column 1': 2,
      'Column 2': 5,
      'Column 3': 15
    },
    taskWorkloads: {
      'task-1': 2,
      'task-2': 4,
      'task-3': 5,
      'task-4': 8,
      'task-5': 1,
      'task-6': 2
    },
    assigned: {
      'User 1': {
        total: 4,
        workload: 9
      },
      'User 2': {
        total: 2,
        workload: 13
      }
    },
    dueTasks: [
      {
        task: 'task-1',
        completed: false,
        completedDate: null,
        dueDate: new Date('2000-01-01T00:00:00.000Z'),
        overdue: true,
        dueDelta: 86400000,
        dueMessage: '1 day overdue'
      },
      {
        task: 'task-2',
        completed: false,
        completedDate: null,
        dueDate: new Date('2000-01-03T00:00:00.000Z'),
        overdue: false,
        dueDelta: -86400000,
        dueMessage: '1 day remaining'
      },
      {
        task: 'task-5',
        completed: true,
        completedDate: new Date('2000-01-01T22:00:00.000Z'),
        dueDate: new Date('2000-01-01T22:30:00.000Z'),
        overdue: false,
        dueDelta: -1800000,
        dueMessage: 'Completed 30 minutes remaining'
      },
      {
        task: 'task-3',
        completed: true,
        completedDate: null,
        dueDate: new Date('2000-01-01T22:30:00.000Z'),
        overdue: false,
        dueDelta: 5400000,
        dueMessage: 'Completed 1 hour, 30 minutes overdue'
      },
      {
        task: 'task-6',
        completed: true,
        completedDate: null,
        dueDate: new Date('2000-01-02T02:00:00.000Z'),
        overdue: false,
        dueDelta: -7200000,
        dueMessage: 'Completed 2 hours remaining'
      }
    ],
  });
});

QUnit.test('Status non-quiet with sprints defined', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          created: new Date('02 December 1999 00:00:00 GMT'),
          due: new Date('03 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium'],
          created: new Date('10 December 1999 00:00:00 GMT'),
          completed: new Date('11 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          created: new Date('16 December 1999 00:00:00 GMT'),
          started: new Date('16 December 1999 01:00:00 GMT'),
          completed: new Date('17 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          created: new Date('18 December 1999 00:00:00 GMT'),
          due: new Date('19 December 1999 00:00:00 GMT')
        }
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
      sprints: [
        {
          name: 'Sprint 1',
          description: 'Test sprint 1',
          start: new Date('01 December 1999 00:00:00 GMT')
        },
        {
          name: 'Sprint 2',
          description: 'Test sprint 2',
          start: new Date('12 December 1999 00:00:00 GMT')
        }
      ]
    }
  });
  assert.deepEqual((await kanbn.status()).sprint, {
    number: 2,
    name: 'Sprint 2',
    start: new Date('12 December 1999 00:00:00 GMT'),
    description: 'Test sprint 2',
    durationDelta: 1814400000,
    durationMessage: '3 weeks',
    created: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        },
        {
          id: 'task-4',
          column: 'Column 3',
          workload: 8
        }
      ],
      workload: 13
    },
    started: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        }
      ],
      workload: 5
    },
    completed: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        }
      ],
      workload: 5
    },
    due: {
      tasks: [
        {
          id: 'task-4',
          column: 'Column 3',
          workload: 8
        }
      ],
      workload: 8
    }
  });
});

QUnit.test('Status non-quiet with specific sprint by number', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          created: new Date('02 December 1999 00:00:00 GMT'),
          due: new Date('03 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium'],
          created: new Date('10 December 1999 00:00:00 GMT'),
          completed: new Date('11 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          created: new Date('16 December 1999 00:00:00 GMT'),
          started: new Date('16 December 1999 01:00:00 GMT'),
          completed: new Date('17 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          created: new Date('18 December 1999 00:00:00 GMT'),
          due: new Date('19 December 1999 00:00:00 GMT')
        }
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
      sprints: [
        {
          name: 'Sprint 1',
          description: 'Test sprint 1',
          start: new Date('01 December 1999 00:00:00 GMT')
        },
        {
          name: 'Sprint 2',
          description: 'Test sprint 2',
          start: new Date('12 December 1999 00:00:00 GMT')
        }
      ]
    }
  });
  const status = await kanbn.status(false, false, false, 1);
  assert.equal('sprint' in status, true);
  assert.deepEqual(status.sprint, {
    current: 2,
    number: 1,
    name: 'Sprint 1',
    start: new Date('01 December 1999 00:00:00 GMT'),
    description: 'Test sprint 1',
    durationDelta: 950400000,
    durationMessage: '1 week, 4 days',
    created: {
      tasks: [
        {
          id: 'task-1',
          column: 'Column 1',
          workload: 2
        },
        {
          id: 'task-2',
          column: 'Column 2',
          workload: 3
        }
      ],
      workload: 5
    },
    started: {
      tasks: [],
      workload: 0
    },
    completed: {
      tasks: [
        {
          id: 'task-2',
          column: 'Column 2',
          workload: 3
        }
      ],
      workload: 3
    },
    due: {
      tasks: [
        {
          id: 'task-1',
          column: 'Column 1',
          workload: 2
        }
      ],
      workload: 2
    }
  });
});

QUnit.test('Status non-quiet with specific sprint by name', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          created: new Date('02 December 1999 00:00:00 GMT'),
          due: new Date('03 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium'],
          created: new Date('10 December 1999 00:00:00 GMT'),
          completed: new Date('11 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          created: new Date('16 December 1999 00:00:00 GMT'),
          started: new Date('16 December 1999 01:00:00 GMT'),
          completed: new Date('17 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          created: new Date('18 December 1999 00:00:00 GMT'),
          due: new Date('19 December 1999 00:00:00 GMT')
        }
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
      sprints: [
        {
          name: 'Sprint 1',
          description: 'Test sprint 1',
          start: new Date('01 December 1999 00:00:00 GMT')
        },
        {
          name: 'Sprint 2',
          description: 'Test sprint 2',
          start: new Date('12 December 1999 00:00:00 GMT')
        }
      ]
    }
  });
  const status = await kanbn.status(false, false, false, 'Sprint 1');
  assert.equal('sprint' in status, true);
  assert.deepEqual(status.sprint, {
    current: 2,
    number: 1,
    name: 'Sprint 1',
    start: new Date('01 December 1999 00:00:00 GMT'),
    description: 'Test sprint 1',
    durationDelta: 950400000,
    durationMessage: '1 week, 4 days',
    created: {
      tasks: [
        {
          id: 'task-1',
          column: 'Column 1',
          workload: 2
        },
        {
          id: 'task-2',
          column: 'Column 2',
          workload: 3
        }
      ],
      workload: 5
    },
    started: {
      tasks: [],
      workload: 0
    },
    completed: {
      tasks: [
        {
          id: 'task-2',
          column: 'Column 2',
          workload: 3
        }
      ],
      workload: 3
    },
    due: {
      tasks: [
        {
          id: 'task-1',
          column: 'Column 1',
          workload: 2
        }
      ],
      workload: 2
    }
  });
});

QUnit.test('Status non-quiet with single date', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          created: new Date('02 December 1999 00:00:00 GMT'),
          due: new Date('03 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium'],
          created: new Date('10 December 1999 00:00:00 GMT'),
          completed: new Date('11 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          created: new Date('16 December 1999 00:00:00 GMT'),
          started: new Date('16 December 1999 01:00:00 GMT'),
          completed: new Date('17 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          created: new Date('18 December 1999 00:00:00 GMT'),
          due: new Date('19 December 1999 00:00:00 GMT')
        }
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
    }
  });
  const status = await kanbn.status(false, false, false, null, [new Date('16 December 1999 00:00:00 GMT')]);
  assert.equal('period' in status, true);
  assert.deepEqual(status.period, {
    start: new Date('16 December 1999 00:00:00 GMT'),
    end: new Date('16 December 1999 23:59:59:999 GMT'),
    created: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        }
      ],
      workload: 5
    },
    started: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        }
      ],
      workload: 5
    },
    completed: {
      tasks: [],
      workload: 0
    },
    due: {
      tasks: [],
      workload: 0
    }
  });
});

QUnit.test('Status non-quiet with date range', async assert => {

  // Initialise and add some tasks
  fixtures({
    tasks: [
      {
        name: 'Task 1',
        metadata: {
          tags: ['Small'],
          created: new Date('02 December 1999 00:00:00 GMT'),
          due: new Date('03 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 2',
        metadata: {
          tags: ['Medium'],
          created: new Date('10 December 1999 00:00:00 GMT'),
          completed: new Date('11 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 3',
        metadata: {
          tags: ['Large'],
          created: new Date('16 December 1999 00:00:00 GMT'),
          started: new Date('16 December 1999 01:00:00 GMT'),
          completed: new Date('17 December 1999 00:00:00 GMT')
        }
      },
      {
        name: 'Task 4',
        metadata: {
          tags: ['Huge'],
          created: new Date('18 December 1999 00:00:00 GMT'),
          due: new Date('19 December 1999 00:00:00 GMT')
        }
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
    }
  });
  const status = await kanbn.status(false, false, false, null, [
    new Date('16 December 1999 00:00:00 GMT'),
    new Date('20 December 1999 00:00:00 GMT')
  ]);
  assert.equal('period' in status, true);
  assert.deepEqual(status.period, {
    start: new Date('16 December 1999 00:00:00 GMT'),
    end: new Date('20 December 1999 00:00:00 GMT'),
    created: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        },
        {
          id: 'task-4',
          column: 'Column 3',
          workload: 8
        }
      ],
      workload: 13
    },
    started: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        }
      ],
      workload: 5
    },
    completed: {
      tasks: [
        {
          id: 'task-3',
          column: 'Column 3',
          workload: 5
        }
      ],
      workload: 5
    },
    due: {
      tasks: [
        {
          id: 'task-4',
          column: 'Column 3',
          workload: 8
        }
      ],
      workload: 8
    }
  });
});
