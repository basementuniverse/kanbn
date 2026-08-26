const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('edit controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.taskExists = true;
    mockConfig.output = null;
    mockConfig.taskColumn = 'Column 1';
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1'],
        'Column 2': []
      },
      options: {}
    };
    mockConfig.task = {
      name: 'Test Task 1',
      description: 'Test description',
      metadata: {
        tags: ['existing-tag']
      },
      subTasks: [
        {
          text: 'Existing sub-task',
          completed: false
        }
      ],
      relations: [
        {
          task: 'test-task-2',
          type: ''
        }
      ],
      comments: []
    };
  }
});

QUnit.test('Edit a task without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Edit a task with no task id specified', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit'], kanbn);
  });

  assert.contains(output, /No task id specified/);
});

QUnit.test('Edit a task that does not exist', async assert => {
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('Edit a task when there are no columns in the index', async assert => {
  mockConfig.index.columns = {};
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No columns defined in the index/);
});

QUnit.test('Edit a task into a column that does not exist', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '-c', 'Column 3'], kanbn);
  });

  assert.contains(output, /Column "Column 3" doesn't exist/);
});

QUnit.test('Edit a task name and description', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-n', 'New name', '-d', 'New description'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Updated task "test-task-1"/);
  assert.strictEqual(mockConfig.output.taskData.name, 'New name');
  assert.strictEqual(mockConfig.output.taskData.description, 'New description');
});

QUnit.test('Editing a task into its current column should not move it', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-c', 'Column 1'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.columnName, null);
});

QUnit.test('Editing a task into a different column should move it', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-c', 'Column 2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.columnName, 'Column 2');
});

QUnit.test('Edit a task due date', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--due', '2026-01-01'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.taskData.metadata.due.toISOString().substr(0, 10), '2026-01-01');
});

QUnit.test('Edit a task with an unparseable due date should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--due', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse due date/);
});

QUnit.test('Edit a task with a non-numeric progress should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--progress', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Progress value is not a number/);
});

QUnit.test('Edit a task progress', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--progress', '0.5'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.taskData.metadata.progress, 0.5);
});

QUnit.test('Add a tag to a task', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-t', 'new-tag'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.metadata.tags, ['existing-tag', 'new-tag']);
});

QUnit.test('Remove a tag from a task', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--remove-tag', 'existing-tag'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.metadata.tags, []);
});

QUnit.test('Remove a tag that does not exist should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--remove-tag', 'not-a-tag'], kanbn);
  });

  assert.contains(output, /Tag "not-a-tag" doesn't exist/);
});

QUnit.test('Add a sub-task to a task', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-s', '[x] New sub-task'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.subTasks, [
    { text: 'Existing sub-task', completed: false },
    { text: 'New sub-task', completed: true }
  ]);
});

QUnit.test('Updating an existing sub-task should change its completed status', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-s', '[x] Existing sub-task'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.subTasks, [
    { text: 'Existing sub-task', completed: true }
  ]);
});

QUnit.test('Add a relation to a task', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '-r', 'blocks test-task-3'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.relations, [
    { task: 'test-task-2', type: '' },
    { task: 'test-task-3', type: 'blocks' }
  ]);
});

QUnit.test('Remove a sub-task from a task', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--remove-sub-task', 'Existing sub-task'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.subTasks, []);
});

QUnit.test('Remove a sub-task that does not exist should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--remove-sub-task', 'Not a sub-task'], kanbn);
  });

  assert.contains(output, /Sub-task "Not a sub-task" doesn't exist/);
});

QUnit.test('Remove a relation from a task', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--remove-relation', 'test-task-2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.taskData.relations, []);
});

QUnit.test('Remove a relation that does not exist should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--remove-relation', 'not-a-task'], kanbn);
  });

  assert.contains(output, /Relation "not-a-task" doesn't exist/);
});

QUnit.test('Unset a metadata field', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--unset', 'due'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.unsetFields, ['due']);
});

QUnit.test('Unset several metadata fields', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--unset', 'due', '--unset', 'assigned'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.unsetFields, ['due', 'assigned']);
});

QUnit.test('Unset a field that cannot be unset should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--unset', 'name'], kanbn);
  });

  assert.contains(output, /Cannot unset "name"/);
});

QUnit.test('Setting and unsetting the same field should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--due', '2026-01-01', '--unset', 'due'], kanbn);
  });

  assert.contains(output, /Cannot set and unset "due" in the same command/);
});

QUnit.test('A custom field can be unset', async assert => {
  mockConfig.index.options.customFields = [
    {
      name: 'points',
      type: 'number'
    }
  ];
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--unset', 'points'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.unsetFields, ['points']);
});

QUnit.test('A custom field value should be type checked', async assert => {
  mockConfig.index.options.customFields = [
    {
      name: 'points',
      type: 'number'
    }
  ];
  const output = await capture.stderr(async () => {
    await mockArgv(['edit', 'test-task-1', '--points', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Custom field "points" value is not a number/);
});

QUnit.test('A custom field value should be set on the task metadata', async assert => {
  mockConfig.index.options.customFields = [
    {
      name: 'points',
      type: 'number'
    }
  ];
  await capture.stdout(async out => {
    await mockArgv(['edit', 'test-task-1', '--points', '5'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.taskData.metadata.points, 5);
});
