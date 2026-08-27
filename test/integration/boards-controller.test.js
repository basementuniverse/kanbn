const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('boards controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.boards = [
      {
        slug: 'index',
        path: 'test/index.md',
        name: 'Test Project',
        description: 'Test description',
        main: true,
        columns: 3,
        tasks: 4,
        completed: 1,
        completedPercentage: 25,
        modified: new Date('2026-01-01T00:00:00.000Z')
      },
      {
        slug: 'design',
        path: 'test/design.md',
        name: 'Design Pipeline',
        description: 'Design work',
        main: false,
        columns: 2,
        tasks: 1,
        completed: 0,
        completedPercentage: 0,
        modified: new Date('2026-01-02T00:00:00.000Z')
      }
    ];
  }
});

QUnit.test('List boards without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['boards'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('List boards', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['boards'], kanbn);
  });

  assert.contains(output, /2 boards/);
  assert.contains(output, /index/);
  assert.contains(output, /main board/);
  assert.contains(output, /Design Pipeline/);
  assert.contains(output, /2 columns, 1 task, 0% complete/);
});

QUnit.test('List boards as JSON', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--json'], kanbn);
  });

  const result = JSON.parse(output.join(''));
  assert.equal(result.length, 2);
  assert.equal(result[0].slug, 'index');
  assert.equal(result[1].name, 'Design Pipeline');
});

QUnit.test('Show cross-board tasks', async assert => {
  mockConfig.crossBoardTasks = [
    { id: 'test-task-1', boards: { index: 'Column 1', design: 'Designing' } }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--tasks'], kanbn);
  });

  assert.deepEqual(mockConfig.output, { crossBoardTasks: true, allTasks: false });
  assert.contains(output, /1 task on more than one board/);
  assert.contains(output, /index: Column 1/);
  assert.contains(output, /design: Designing/);
});

QUnit.test('Show cross-board tasks with no multi-board tasks', async assert => {
  mockConfig.crossBoardTasks = [];
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--tasks'], kanbn);
  });

  assert.contains(output, /No tasks appear on more than one board/);
});

QUnit.test('Show every tracked task with --all', async assert => {
  mockConfig.crossBoardTasks = [{ id: 'test-task-1', boards: { index: 'Column 1' } }];
  await capture.stdout(async () => {
    await mockArgv(['boards', '--tasks', '--all'], kanbn);
  });

  assert.deepEqual(mockConfig.output, { crossBoardTasks: true, allTasks: true });
});

QUnit.test('Rename a board', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--rename', 'design', 'ux'], kanbn);
  });

  assert.deepEqual(mockConfig.output, { renameBoard: 'design', newSlug: 'ux', newName: null });
  assert.contains(output, /Renamed board "design" to "ux"/);
});

QUnit.test('Rename a board display name only', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--rename', 'design', '--name', 'UX Pipeline'], kanbn);
  });

  assert.deepEqual(mockConfig.output, { renameBoard: 'design', newSlug: 'design', newName: 'UX Pipeline' });
  assert.contains(output, /Renamed board "design" to "UX Pipeline"/);
});

QUnit.test('Rename a board with nothing to rename it to', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['boards', '--rename', 'design'], kanbn);
  });

  assert.contains(output, /No new board slug or name specified/);
});

QUnit.test('Delete a board', async assert => {
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--delete', 'design'], kanbn);
  });

  assert.deepEqual(mockConfig.output, { deleteBoard: 'design' });
  assert.contains(output, /Deleted board "design"/);
});

QUnit.test('Delete a board that would orphan tasks', async assert => {
  mockConfig.orphanedTasks = ['test-task-1', 'test-task-2'];
  const output = await capture.stderr(async () => {
    await mockArgv(['boards', '--delete', 'design'], kanbn);
  });

  assert.contains(output, /would leave 2 tasks untracked/);
  assert.equal(mockConfig.output, null, 'the board should not be deleted');
});

QUnit.test('Delete a board that would orphan tasks with force', async assert => {
  mockConfig.orphanedTasks = ['test-task-1'];
  const output = await capture.stdout(async () => {
    await mockArgv(['boards', '--delete', 'design', '-f'], kanbn);
  });

  assert.deepEqual(mockConfig.output, { deleteBoard: 'design' });
  assert.contains(output, /1 task is now untracked/);
});
