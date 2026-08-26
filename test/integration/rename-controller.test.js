const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('rename controller tests', {
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

QUnit.test('Rename a task without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['rename', 'test-task-1'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Rename a task with no task id specified', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['rename'], kanbn);
  });

  assert.contains(output, /No task id specified/);
});

QUnit.test('Rename a task that does not exist', async assert => {
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['rename', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('Rename a task to its current name should print an error', async assert => {
  const output = await capture.stderr(async out => {
    await mockArgv(['rename', 'test-task-1', '-n', mockConfig.task.name], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, new RegExp(`Task "test-task-1" already has the name "${mockConfig.task.name}"`));
  assert.strictEqual(mockConfig.output, null);
});

QUnit.test('Rename a task', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['rename', 'test-task-1', '-n', 'Renamed Task'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Renamed task "test-task-1" to "renamed-task"/);
  assert.deepEqual(mockConfig.output, {
    taskId: 'test-task-1',
    newTaskName: 'Renamed Task'
  });
});

QUnit.test('The --name option should be equivalent to -n', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['rename', 'test-task-1', '--name', 'Renamed Task'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.newTaskName, 'Renamed Task');
});

// Interactive tests load the controller with a fake inquirer, rather than driving the real prompt
// over stdin, so the prompt definition itself gets exercised
const mockInquirer = require('../mock-inquirer');

const RENAME_CONTROLLER = '../src/controller/rename';

QUnit.module('rename controller interactive tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.taskExists = true;
    mockConfig.output = null;
  },
  after() {
    mockInquirer.unloadController(RENAME_CONTROLLER);
  }
});

QUnit.test('Rename a task interactively', async assert => {
  const { controller } = mockInquirer.loadController(RENAME_CONTROLLER, [{ name: 'Interactive name' }]);

  const output = await capture.stdout(async out => {
    await controller({ _: ['rename', 'test-task-1'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Renamed task "test-task-1" to "interactive-name"/);
  assert.strictEqual(mockConfig.output.newTaskName, 'Interactive name');
});

QUnit.test('The interactive name prompt should default to the current name', async assert => {
  const { controller, inquirer } = mockInquirer.loadController(RENAME_CONTROLLER, [{ name: 'Interactive name' }]);

  await capture.stdout(async out => {
    await controller({ _: ['rename', 'test-task-1'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(inquirer.questions[0][0].default, mockConfig.task.name);
});

QUnit.test('The interactive name prompt should be pre-filled from the name argument', async assert => {
  const { controller, inquirer } = mockInquirer.loadController(RENAME_CONTROLLER, [{ name: 'Interactive name' }]);

  await capture.stdout(async out => {
    await controller({ _: ['rename', 'test-task-1'], interactive: true, name: 'Argument name' });
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(inquirer.questions[0][0].default, 'Argument name');
});

QUnit.test('An empty name should be rejected', async assert => {
  const { controller } = mockInquirer.loadController(RENAME_CONTROLLER, [{ name: '' }]);

  const output = await capture.stderr(async out => {
    await controller({ _: ['rename', 'test-task-1'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Task name cannot be empty/);
  assert.strictEqual(mockConfig.output, null);
});

QUnit.test('Renaming a task to its current name interactively should print an error', async assert => {
  const { controller } = mockInquirer.loadController(RENAME_CONTROLLER, [{ name: mockConfig.task.name }]);

  const output = await capture.stderr(async out => {
    await controller({ _: ['rename', 'test-task-1'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /already has the name/);
  assert.strictEqual(mockConfig.output, null);
});
