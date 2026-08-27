const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('remove controller tests', {
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
  }
});

QUnit.test('Remove a task without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['remove', 'test-task-1'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Remove a task with no task id specified', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['remove'], kanbn);
  });

  assert.contains(output, /No task id specified/);
});

QUnit.test('Remove a task that does not exist', async assert => {
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['remove', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('Remove a task with the force flag should not prompt for confirmation', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['remove', 'test-task-1', '-f'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Removed task "test-task-1" file and index entry/);
  assert.deepEqual(mockConfig.output, {
    taskId: 'test-task-1',
    removeFile: true,
    allBoards: false
  });
});

QUnit.test('Remove a task with the index flag should only remove the index entry', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['remove', 'test-task-1', '-f', '-x'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Removed task "test-task-1" from the index/);
  assert.deepEqual(mockConfig.output, {
    taskId: 'test-task-1',
    removeFile: false,
    allBoards: false
  });
});

QUnit.test('Remove a task should remove it when the prompt is confirmed', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['remove', 'test-task-1'], kanbn);
    await context.sendInput([['y', context.keys.enter]]);
    await capture.waitFor(() => out.some(s => /Removed task/.test(s)));
  });

  assert.contains(output, /Removed task "test-task-1"/);
  assert.strictEqual(mockConfig.output.taskId, 'test-task-1');
});

QUnit.test('Remove a task should do nothing when the prompt is declined', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['remove', 'test-task-1'], kanbn);
    await context.sendInput([['n', context.keys.enter]]);
    await context.sleep(100);
  });

  assert.strictEqual(mockConfig.output, null);
});
