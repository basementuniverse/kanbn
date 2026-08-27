const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('board mutation tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.taskExists = true;
    mockConfig.boards = [
      { slug: 'index', path: 'test/index.md', name: 'Test Project', description: '', main: true },
      { slug: 'design', path: 'test/design.md', name: 'Design Pipeline', description: '', main: false }
    ];
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: { 'Column 1': ['test-task-1'], 'Column 2': [] },
      options: {}
    };
    mockConfig.taskColumn = 'Column 1';
    mockConfig.taskBoards = { index: 'Column 1' };
    delete process.env.KANBN_BOARD;
  },
  afterEach() {
    delete process.env.KANBN_BOARD;
  }
});

// Every mutating command takes -b, and targets the main board without it
const mutatingCommands = [
  ['add', '-n', 'New Task'],
  ['edit', 'test-task-1', '-n', 'Renamed'],
  ['move', 'test-task-1', '-c', 'Column 2'],
  ['remove', 'test-task-1', '-f'],
  ['sort', 'Column 1', '--name'],
  ['comment', 'test-task-1', '-t', 'A comment'],
  ['rename', 'test-task-1', '-n', 'Renamed'],
  ['archive', 'test-task-1'],
  ['restore', 'test-task-1']
];

for (const command of mutatingCommands) {
  QUnit.test(`${command[0]} should target the board given by --board`, async assert => {
    mockConfig.taskBoards = { index: 'Column 1', design: 'Column 1' };
    await capture.stdout(async () => {
      await mockArgv([...command, '-b', 'design'], kanbn);
      await context.sleep(50);
    });

    assert.equal(mockConfig.boardSlug, 'design');
  });

  QUnit.test(`${command[0]} should error for a board that doesn't exist`, async assert => {
    const output = await capture.stderr(async () => {
      await mockArgv([...command, '-b', 'nope'], kanbn);
      await context.sleep(50);
    });

    assert.contains(output, /Board "nope" doesn't exist/);
  });
}

QUnit.test('add should create a task once and add it to every board named', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['add', '-n', 'New Task', '-b', 'index', '-b', 'design', '-c', 'Column 1', '-c', 'Column 2'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Created task .* in column "Column 1" on board "index"/);
  assert.contains(output, /Added task .* to column "Column 2" on board "design"/);
});

QUnit.test('add should fall back to the first column when a board has not got the one asked for', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['add', '-n', 'New Task', '-b', 'index', '-b', 'design', '-c', 'Column 1', '-c', 'Nonexistent'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Board "design" has no column "Nonexistent" - using "Column 1"/);
});

QUnit.test('add with a single board should still reject an unknown column', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['add', '-n', 'New Task', '-b', 'design', '-c', 'Nonexistent'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Column "Nonexistent" doesn't exist/);
});

QUnit.test('move should add a task to a board it is not on yet', async assert => {
  mockConfig.taskBoards = { index: 'Column 1' };
  const output = await capture.stdout(async () => {
    await mockArgv(['move', 'test-task-1', '-b', 'design', '-c', 'Column 2'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /wasn't on board "design" - it has been added/);
  assert.deepEqual(mockConfig.output, { untrackedTask: 'test-task-1', columnName: 'Column 2' });
});

QUnit.test('move with --no-add should refuse instead of adding', async assert => {
  mockConfig.taskBoards = { index: 'Column 1' };
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1', '-b', 'design', '-c', 'Column 2', '--no-add'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Task "test-task-1" is not on board "design"/);
  assert.equal(mockConfig.output, null);
});

QUnit.test('move on the main board should never add implicitly', async assert => {
  mockConfig.taskBoards = {};
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('remove should pass --all-boards through', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['remove', 'test-task-1', '-f', '--all-boards'], kanbn);
    await context.sleep(50);
  });

  assert.deepEqual(mockConfig.output, { taskId: 'test-task-1', removeFile: true, allBoards: true });
});

QUnit.test('remove with the index flag should keep the task file', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['remove', 'test-task-1', '-f', '-x', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.deepEqual(mockConfig.output, { taskId: 'test-task-1', removeFile: false, allBoards: false });
});

QUnit.test('remove should suggest --all-boards when the task is on other boards', async assert => {
  mockConfig.errors.deleteTask = 'Task "test-task-1" is on 1 other board (design)';
  const output = await capture.stderr(async () => {
    await mockArgv(['remove', 'test-task-1', '-f'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /is on 1 other board \(design\)/);
  assert.contains(output, /Use .*--all-boards.* to remove it from all of them/);
  assert.contains(output, /--index.* to remove it from this board only/);
});

QUnit.test('remove on a secondary board should say which board it removed from', async assert => {
  mockConfig.taskBoards = { index: 'Column 1', design: 'Column 1' };
  const output = await capture.stdout(async () => {
    await mockArgv(['remove', 'test-task-1', '-f', '-x', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Removed task "test-task-1" from the index on board "design"/);
});

QUnit.test('restore should restore to every remembered board by default', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['restore', 'test-task-1'], kanbn);
    await context.sleep(50);
  });

  assert.equal(mockConfig.output.singleBoard, false);
});

QUnit.test('restore with --board should restore to that board only', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['restore', 'test-task-1', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.equal(mockConfig.output.singleBoard, true);
});

QUnit.test('restore should report boards that no longer exist', async assert => {
  mockConfig.restoreWarnings = ['ops'];
  const output = await capture.stdout(async () => {
    await mockArgv(['restore', 'test-task-1'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Couldn't restore "test-task-1" to board "ops" - no longer exists/);
});
