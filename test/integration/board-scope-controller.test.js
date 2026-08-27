const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('board scope tests', {
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
      columns: { 'Column 1': ['test-task-1'] },
      options: {}
    };
    delete process.env.KANBN_BOARD;
  },
  afterEach() {
    delete process.env.KANBN_BOARD;
  }
});

// -b is accepted by every read-only command, and resolves to the main board when it isn't given
const readOnlyCommands = [
  ['board'],
  ['status'],
  ['task', 'test-task-1'],
  ['find'],
  ['validate']
];

for (const command of readOnlyCommands) {
  QUnit.test(`${command[0]} should target the main board by default`, async assert => {
    await capture.stdout(async () => {
      await mockArgv(command, kanbn);
      await context.sleep(50);
    });

    assert.equal(mockConfig.boardSlug, null, 'no board slug should be requested');
  });

  QUnit.test(`${command[0]} should target the board given by --board`, async assert => {
    await capture.stdout(async () => {
      await mockArgv([...command, '-b', 'design'], kanbn);
      await context.sleep(50);
    });

    assert.equal(mockConfig.boardSlug, 'design');
  });

  QUnit.test(`${command[0]} should fall back to KANBN_BOARD`, async assert => {
    process.env.KANBN_BOARD = 'design';
    await capture.stdout(async () => {
      await mockArgv(command, kanbn);
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

QUnit.test('--board should win over KANBN_BOARD', async assert => {
  process.env.KANBN_BOARD = 'index';
  await capture.stdout(async () => {
    await mockArgv(['status', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.equal(mockConfig.boardSlug, 'design');
});

QUnit.test('task should show the boards a task appears on', async assert => {
  mockConfig.taskBoards = { index: 'Column 1', design: 'Designing' };
  const output = await capture.stdout(async () => {
    await mockArgv(['task', 'test-task-1'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Boards/);
  assert.contains(output, /index: Column 1/);
  assert.contains(output, /design: Designing/);
});

QUnit.test('task should include board membership in JSON output', async assert => {
  mockConfig.taskBoards = { index: 'Column 1', design: 'Designing' };
  const output = await capture.stdout(async written => {
    await mockArgv(['task', 'test-task-1', '--json'], kanbn);
    await capture.waitFor(() => written.length > 0);
  });

  assert.deepEqual(JSON.parse(output.join('')).boards, { index: 'Column 1', design: 'Designing' });
});

QUnit.test('board should hint at the other boards when there is more than one', async assert => {
  const output = await capture.stdout(async written => {
    await mockArgv(['board'], kanbn);
    await capture.waitFor(() => written.join('').includes('boards available'));
  });

  assert.contains(output, /2 boards available/);
});

QUnit.test('board should not hint when there is only one board', async assert => {
  mockConfig.boards = [
    { slug: 'index', path: 'test/index.md', name: 'Test Project', description: '', main: true }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(['board'], kanbn);
    await context.sleep(100);
  });

  assert.false(output.join('').includes('boards available'));
});

QUnit.test('board should not hint in JSON output', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['board', '--json'], kanbn);
    await context.sleep(100);
  });

  assert.false(output.join('').includes('boards available'));
});
