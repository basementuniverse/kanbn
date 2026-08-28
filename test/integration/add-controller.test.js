const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');
const context = require('../context');

let kanbn;

QUnit.module('add task controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
  }
});

QUnit.test('Add a task without initialising kanbn', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  mockConfig.initialised = false;
  await mockArgv(['add'], kanbn);

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Add a task when there are no columns in the index', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  const backupColumns = mockConfig.index.columns;
  mockConfig.index.columns = [];
  await mockArgv(['add'], kanbn);
  mockConfig.index.columns = backupColumns;

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /No columns defined in the index/);
});

QUnit.test('Add a task to an invalid column', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  await mockArgv(['add', '-c', 'This column does not exist'], kanbn);

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /Column ".+" doesn't exist/);
});

QUnit.test('Add untracked tasks with no untracked tasks', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  await mockArgv(['add', '-u'], kanbn);

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /No untracked tasks to add/);
});

QUnit.module('add task controller argument tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.trackedTasks = ['test-task-1'];
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': [],
        'Column 2': []
      },
      options: {}
    };
  }
});

/**
 * Run the add controller and return the task data it created
 * @param {string[]} argv The CLI arguments
 * @return {Promise<object>} The output recorded by the mock kanbn library
 */
async function add(argv) {
  await capture.stdout(async out => {
    await mockArgv(argv, kanbn);
    await capture.waitFor(() => out.length > 0);
  });
  return mockConfig.output;
}

QUnit.test('Add a task with a name and description', async assert => {
  const output = await add(['add', '-n', 'Test name', '-d', 'Test description']);

  assert.strictEqual(output.taskData.name, 'Test name');
  assert.strictEqual(output.taskData.description, 'Test description');
});

QUnit.test('Add a task should default to the first column', async assert => {
  const output = await add(['add', '-n', 'Test name']);

  assert.strictEqual(output.columnName, 'Column 1');
});

QUnit.test('Add a task to a named column', async assert => {
  const output = await add(['add', '-n', 'Test name', '-c', 'Column 2']);

  assert.strictEqual(output.columnName, 'Column 2');
});

QUnit.test('Add a task with dates', async assert => {
  const output = await add([
    'add',
    '-n', 'Test name',
    '--due', '2026-06-01',
    '--plannedStart', '2026-05-01',
    '--plannedFinish', '2026-05-31'
  ]);

  assert.strictEqual(output.taskData.metadata.due.toISOString().substr(0, 10), '2026-06-01');
  assert.strictEqual(output.taskData.metadata.plannedStart.toISOString().substr(0, 10), '2026-05-01');
  assert.strictEqual(output.taskData.metadata.plannedFinish.toISOString().substr(0, 10), '2026-05-31');
});

QUnit.test('Add a task with an unparseable due date should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--due', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse due date/);
});

QUnit.test('Add a task with an unparseable plannedStart date should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--plannedStart', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse plannedStart date/);
});

QUnit.test('Add a task with an unparseable plannedFinish date should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--plannedFinish', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse plannedFinish date/);
});

QUnit.test('Add a task with progress', async assert => {
  const output = await add(['add', '-n', 'Test name', '--progress', '0.25']);

  assert.strictEqual(output.taskData.metadata.progress, 0.25);
});

QUnit.test('Add a task with non-numeric progress should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--progress', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Progress value is not a number/);
});

QUnit.test('Add a task with sub-tasks', async assert => {
  const output = await add(['add', '-n', 'Test name', '-s', '[x] Done sub-task', '-s', 'Todo sub-task']);

  assert.deepEqual(output.taskData.subTasks, [
    { completed: true, text: 'Done sub-task' },
    { completed: false, text: 'Todo sub-task' }
  ]);
});

QUnit.test('Add a task with tags', async assert => {
  const output = await add(['add', '-n', 'Test name', '-t', 'one', '-t', 'two']);

  assert.deepEqual(output.taskData.metadata.tags, ['one', 'two']);
});

QUnit.test('Add a task with a relation', async assert => {
  const output = await add(['add', '-n', 'Test name', '-r', 'blocks:test-task-1']);

  assert.deepEqual(output.taskData.relations, [{ type: 'blocks', task: 'test-task-1' }]);
});

QUnit.test('Add a task with an untyped relation', async assert => {
  const output = await add(['add', '-n', 'Test name', '-r', 'test-task-1']);

  assert.deepEqual(output.taskData.relations, [{ type: '', task: 'test-task-1' }]);
});

QUnit.test('Add a task related to a task that does not exist should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '-r', 'not-a-task'], kanbn);
  });

  assert.contains(output, /Related task not-a-task doesn't exist/);
});

QUnit.test('Add a task with a numeric custom field', async assert => {
  mockConfig.index.options.customFields = [{ name: 'points', type: 'number' }];
  const output = await add(['add', '-n', 'Test name', '--points', '5']);

  assert.strictEqual(output.taskData.metadata.points, 5);
});

QUnit.test('Add a task with a non-numeric custom field value should print an error', async assert => {
  mockConfig.index.options.customFields = [{ name: 'points', type: 'number' }];
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--points', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Custom field "points" value is not a number/);
});

QUnit.test('Add a task with a boolean custom field', async assert => {
  mockConfig.index.options.customFields = [{ name: 'urgent', type: 'boolean' }];
  const output = await add(['add', '-n', 'Test name', '--urgent']);

  assert.strictEqual(output.taskData.metadata.urgent, true);
});

QUnit.test('Add a task with a non-boolean custom field value should print an error', async assert => {
  mockConfig.index.options.customFields = [{ name: 'urgent', type: 'boolean' }];
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--urgent', 'yes'], kanbn);
  });

  assert.contains(output, /Custom field "urgent" value is not a boolean/);
});

QUnit.test('Add a task with a date custom field', async assert => {
  mockConfig.index.options.customFields = [{ name: 'reviewed', type: 'date' }];
  const output = await add(['add', '-n', 'Test name', '--reviewed', '2026-03-01']);

  assert.strictEqual(output.taskData.metadata.reviewed.toISOString().substr(0, 10), '2026-03-01');
});

QUnit.test('Add a task with an unparseable date custom field should print an error', async assert => {
  mockConfig.index.options.customFields = [{ name: 'reviewed', type: 'date' }];
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'Test name', '--reviewed', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse date for custom field "reviewed"/);
});

QUnit.test('Add named untracked tasks to the index', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['add', '-u', 'untracked-1', '-c', 'Column 2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Added 1 task to column "Column 2"/);
  assert.deepEqual(mockConfig.output, {
    untrackedTask: 'untracked-1',
    columnName: 'Column 2'
  });
});

QUnit.test('Add all untracked tasks to the index', async assert => {
  mockConfig.untrackedTasks = ['untracked-1', 'untracked-2'];
  const output = await capture.stdout(async out => {
    await mockArgv(['add', '-u'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Added 2 tasks to column "Column 1"/);
});

QUnit.test('Add a task with a bare --assigned should assign it to the current user', async assert => {
  mockConfig.currentUser = 'gordon';
  await capture.stdout(async out => {
    await mockArgv(['add', '-n', 'Test task', '--assigned'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.taskData.metadata.assigned, 'gordon');
});

QUnit.test('Add a task with a bare --assigned and no current user should leave it unassigned', async assert => {
  mockConfig.currentUser = null;
  await capture.stdout(async out => {
    await mockArgv(['add', '-n', 'Test task', '--assigned'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual('assigned' in mockConfig.output.taskData.metadata, false);
});
