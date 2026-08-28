const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('task controller tests', {
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
    mockConfig.task = {
      name: 'Test Task 1',
      description: 'Test task description',
      metadata: {},
      subTasks: [],
      relations: [],
      comments: []
    };
  }
});

QUnit.test('View a task without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['task', 'test-task-1'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('View a task with no task id specified', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['task'], kanbn);
  });

  assert.contains(output, /No task id specified/);
});

QUnit.test('View a task that does not exist', async assert => {
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['task', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('View a simple task should say what it is and how to promote it', async assert => {
  mockConfig.taskExists = false;
  mockConfig.simpleTasks = [{ column: 'Column 1', position: 1, text: 'Buy milk', raw: '- Buy milk' }];
  const output = await capture.stderr(async () => {
    await mockArgv(['task', 'Buy milk'], kanbn);
  });

  assert.contains(output, /"Buy milk" is a simple task in column "Column 1"/);
  assert.contains(output, /kanbn edit "Buy milk"/);
});

QUnit.test('View a task should render the task as markdown', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['task', 'test-task-1'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Test Task 1/);
  assert.contains(output, /Test task description/);
});

QUnit.test('View a task with the json flag should print the task as JSON', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['task', 'test-task-1', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const task = JSON.parse(output.join(''));
  assert.strictEqual(task.id, 'test-task-1');
  assert.strictEqual(task.name, 'Test Task 1');
  assert.strictEqual(task.description, 'Test task description');
});

QUnit.test('The -j alias should also print the task as JSON', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['task', 'test-task-1', '-j'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(JSON.parse(output.join('')).name, 'Test Task 1');
});
