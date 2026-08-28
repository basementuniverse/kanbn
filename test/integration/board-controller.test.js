const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

function testTask(id, name, metadata = {}) {
  return {
    id,
    name,
    description: '',
    metadata: { created: new Date('2026-01-01T00:00:00.000Z'), ...metadata },
    subTasks: [],
    relations: [],
    comments: []
  };
}

QUnit.module('board controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1'],
        'Column 2': ['test-task-2']
      },
      options: {}
    };
    mockConfig.trackedTasks = [
      testTask('test-task-1', 'Test Task 1'),
      testTask('test-task-2', 'Test Task 2')
    ];
  }
});

QUnit.test('Show the board without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['board'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Show the board when there are no columns in the index', async assert => {
  mockConfig.index.columns = {};
  const output = await capture.stderr(async () => {
    await mockArgv(['board'], kanbn);
  });

  assert.contains(output, /No columns defined in the index/);
});

// The board table is drawn by terminal-kit, which binds process.stdout.write when it's first
// required and so can't be intercepted, and which renders nothing when stdout isn't a tty. The
// table itself therefore can't be asserted on here - the board's contents are covered through the
// JSON output below, which goes through the same view, filter and lane logic.
QUnit.test('Show the board should not print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['board'], kanbn);
    await context.sleep(100);
  });

  assert.deepEqual(output, []);
});

QUnit.test('Show the board should hint about tasks whose dates disagree with their column', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Column 2',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['board'], kanbn);
    await capture.waitFor(() => out.some(s => /dates that don't match/.test(s)));
  });

  assert.contains(output, /1 task has dates that don't match its column/);
  assert.contains(output, /kanbn validate --fix/);
});

QUnit.test('Show the board should hint about tasks with no task file', async assert => {
  mockConfig.missingTaskFiles = [{ task: 'test-task-3', column: 'Column 1' }];
  const output = await capture.stdout(async out => {
    await mockArgv(['board'], kanbn);
    await capture.waitFor(() => out.some(s => /no task file/.test(s)));
  });

  assert.contains(output, /1 task has no task file and was skipped/);
  assert.contains(output, /kanbn validate/);
});

QUnit.test('The missing task file hint should be suppressed for JSON output', async assert => {
  mockConfig.missingTaskFiles = [{ task: 'test-task-3', column: 'Column 1' }];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.notOk(/no task file/.test(output));
});

QUnit.test('The date drift hint should be suppressed for JSON output', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Column 2',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
    await context.sleep(100);
  });

  assert.strictEqual(output.join('').indexOf("dates that don't match"), -1);
});

QUnit.test('The date drift hint should be suppressed when the board is not verbose', async assert => {
  mockConfig.index.options.verbose = false;
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Column 2',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(['board'], kanbn);
    await context.sleep(100);
  });

  assert.strictEqual(output.join('').indexOf("dates that don't match"), -1);
});

QUnit.test('Simple tasks should be left out of JSON output', async assert => {
  mockConfig.index.columnContent = {
    'Column 1': [{ position: 1, text: 'Buy milk', raw: '- Buy milk' }]
  };
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.notOk(/Buy milk/.test(output.join('')));
});

QUnit.test('Show the board as JSON', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const board = JSON.parse(output.join(''));
  assert.deepEqual(board.headings.map(heading => heading.name), ['Column 1', 'Column 2']);
  assert.strictEqual(board.lanes.length, 1);
  assert.strictEqual(board.lanes[0].name, 'All tasks');
  assert.deepEqual(
    board.lanes[0].columns.map(column => column.map(task => task.id)),
    [['test-task-1'], ['test-task-2']]
  );
});

QUnit.test('Show the board with a view that does not exist should print an error', async assert => {
  const output = await capture.stderr(async out => {
    await mockArgv(['board', '-v', 'not-a-view'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /No view found with name "not-a-view"/);
});

QUnit.test('Show the board with a named view', async assert => {
  mockConfig.index.options.views = [
    {
      name: 'test-view',
      columns: [
        {
          name: 'Everything',
          filters: {}
        }
      ]
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '-v', 'test-view', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const board = JSON.parse(output.join(''));
  assert.deepEqual(board.headings.map(heading => heading.name), ['Everything']);
  assert.deepEqual(board.lanes[0].columns[0].map(task => task.id), ['test-task-1', 'test-task-2']);
});

QUnit.test('Hidden columns should be left off the board', async assert => {
  mockConfig.index.options.hiddenColumns = ['Column 2'];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const board = JSON.parse(output.join(''));
  assert.deepEqual(board.headings.map(heading => heading.name), ['Column 1']);
});

QUnit.test('Column headings should mark started and completed columns', async assert => {
  mockConfig.index.options.startedColumns = ['Column 1'];
  mockConfig.index.options.completedColumns = ['Column 2'];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const board = JSON.parse(output.join(''));
  assert.equal(/»/.test(board.headings[0].heading), true, 'started columns are marked');
  assert.equal(/✓/.test(board.headings[1].heading), true, 'completed columns are marked');
});

QUnit.test('A view can filter and sort the tasks in a column', async assert => {
  mockConfig.trackedTasks = [
    testTask('test-task-1', 'Test Task 1', { tags: ['keep'] }),
    testTask('test-task-2', 'Test Task 2', { tags: ['drop'] })
  ];
  mockConfig.index.options.views = [
    {
      name: 'tagged',
      filters: { tag: 'keep' },
      columns: [
        {
          name: 'Kept',
          filters: {},
          sorters: [{ field: 'name', filter: '', order: 'descending' }]
        }
      ]
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '-v', 'tagged', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const board = JSON.parse(output.join(''));
  assert.deepEqual(board.lanes[0].columns[0].map(task => task.id), ['test-task-1']);
});

QUnit.test('A view can split tasks into lanes', async assert => {
  mockConfig.trackedTasks = [
    testTask('test-task-1', 'Test Task 1', { assigned: 'Alex' }),
    testTask('test-task-2', 'Test Task 2', { assigned: 'Sam' })
  ];
  mockConfig.index.options.views = [
    {
      name: 'by-assignee',
      lanes: [
        { name: 'Alex', filters: { assigned: 'Alex' } },
        { name: 'Sam', filters: { assigned: 'Sam' } }
      ]
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '-v', 'by-assignee', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const board = JSON.parse(output.join(''));
  assert.deepEqual(board.lanes.map(lane => lane.name), ['Alex', 'Sam']);
  assert.deepEqual(board.lanes[0].columns.flat().map(task => task.id), ['test-task-1']);
  assert.deepEqual(board.lanes[1].columns.flat().map(task => task.id), ['test-task-2']);
});

QUnit.test('Rendering a task with every field populated should not print an error', async assert => {
  mockConfig.index.options.customFields = [{ name: 'points', type: 'number' }];
  mockConfig.index.options.taskTemplate = '${name} ${due} ${assigned} ${tags} ${progress} ${points}';
  mockConfig.trackedTasks = [
    testTask('test-task-1', 'Test Task 1', {
      updated: new Date('2026-01-02T00:00:00.000Z'),
      started: new Date('2026-01-03T00:00:00.000Z'),
      completed: new Date('2026-01-04T00:00:00.000Z'),
      due: new Date('2026-01-05T00:00:00.000Z'),
      assigned: 'Alex',
      tags: ['one'],
      points: 3
    })
  ];

  const output = await capture.stderr(async () => {
    await mockArgv(['board'], kanbn);
    await context.sleep(100);
  });

  assert.deepEqual(output, []);
});

QUnit.test('A task template that cannot be built should print an error', async assert => {
  mockConfig.index.options.taskTemplate = '${nope(}';

  const output = await capture.stderr(async out => {
    await mockArgv(['board'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Unable to build task template/);
});
