const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('board reporting tests', {
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

for (const command of [['history'], ['burndown'], ['gantt'], ['sprint']]) {
  QUnit.test(`${command[0]} should target the board given by --board`, async assert => {
    await capture.stdout(async () => {
      await mockArgv([...command, '-b', 'design'], kanbn);
      await context.sleep(50);
    });

    assert.equal(mockConfig.boardSlug, 'design');
  });
}

QUnit.test('--sprint and --all-boards together should be refused', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['find', '--all-boards', '--sprint', '1'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /--sprint.* and .*--all-boards.* cannot be used together/);
  assert.equal(mockConfig.output, null);
});

QUnit.test('find --all-boards should search every board', async assert => {
  mockConfig.searchResults = [{ id: 'test-task-1', boards: { index: 'Column 1' } }];
  await capture.stdout(async () => {
    await mockArgv(['find', '--all-boards', '--name', 'Test'], kanbn);
    await capture.waitFor(() => mockConfig.output !== null);
  });

  assert.true(mockConfig.output.allBoards);
});

QUnit.test('find without --all-boards should search one board', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['find', '--name', 'Test'], kanbn);
    await capture.waitFor(() => mockConfig.output !== null);
  });

  assert.equal(mockConfig.output.allBoards, undefined);
});

QUnit.test('validate --all-boards should validate every board', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['validate', '--all-boards'], kanbn);
    await context.sleep(50);
  });

  assert.deepEqual(mockConfig.output, { save: false, allBoards: true });
});

QUnit.test('validate should report multi-board warnings', async assert => {
  mockConfig.boardWarnings = [
    { board: 'design', type: 'workspace-scoped-option', message: '"dateFormat" is a workspace-scoped option and is ignored in a board file' },
    { board: null, type: 'untracked-task', message: 'task "loose-task" isn\'t on any board' }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(['validate'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /2 warnings:/);
  assert.contains(output, /design: "dateFormat" is a workspace-scoped option/);
  assert.contains(output, /workspace: task "loose-task" isn't on any board/);
});

QUnit.test('validate --json should carry drift and warnings once there are several boards', async assert => {
  mockConfig.boardWarnings = [{ board: 'design', type: 'untracked-task', message: 'a warning' }];
  const output = await capture.stdout(async () => {
    await mockArgv(['validate', '--json'], kanbn);
    await context.sleep(50);
  });

  const result = JSON.parse(output.join(''));
  assert.deepEqual(result.drift, []);
  assert.equal(result.warnings.length, 1);
});

QUnit.test('validate --json should stay the bare drift list with one board', async assert => {
  mockConfig.boards = [
    { slug: 'index', path: 'test/index.md', name: 'Test Project', description: '', main: true }
  ];
  mockConfig.dateDrift = [{ task: 'test-task-1', field: 'completed', message: 'a drift message', fixable: true }];
  const output = await capture.stdout(async () => {
    await mockArgv(['validate', '--json'], kanbn);
    await context.sleep(50);
  });

  assert.deepEqual(JSON.parse(output.join('')), mockConfig.dateDrift);
});

QUnit.test('sprint on a secondary board should say which list it wrote to', async assert => {
  mockConfig.sprintData = {
    name: 'Sprint 1',
    start: new Date('2026-01-01T00:00:00.000Z'),
    board: null
  };
  const output = await capture.stdout(async () => {
    await mockArgv(['sprint', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Added to the workspace sprint list/);
});

QUnit.test('sprint on a board with its own list should say so', async assert => {
  mockConfig.sprintData = {
    name: 'Design Sprint 2',
    start: new Date('2026-01-01T00:00:00.000Z'),
    board: 'design'
  };
  const output = await capture.stdout(async () => {
    await mockArgv(['sprint', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Added to board "design"'s own sprint list/);
});

QUnit.test('sprint on the main board should say nothing extra', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['sprint'], kanbn);
    await context.sleep(50);
  });

  assert.false(output.join('').includes('sprint list'));
});
