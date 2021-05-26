const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('restore controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.initialised = false;
    mockConfig.output = null;
  }
});

QUnit.test('Restore task in uninitialised folder', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  await mockArgv(['restore'], kanbn);

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Restore a task with no task specified', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['restore'], kanbn);

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /No task id specified/);
});

QUnit.test('Restore a task with no columns defined in the index', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  const backupIndex = mockConfig.index;
  mockConfig.index = {
    name: 'Test Project',
    description: 'Test description',
    columns: [],
    options: {}
  };
  mockConfig.initialised = true;
  await mockArgv(['restore', 'task-1'], kanbn);
  mockConfig.index = backupIndex;

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /No columns defined in the index/);
});

QUnit.test("Restore a task into a column that doesn't exist", async assert => {
  const output = [];
  captureConsole.startIntercept(process.stderr, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['restore', 'task-1', '-c', 'Test Column 2'], kanbn);

  captureConsole.stopIntercept(process.stderr);
  assert.contains(output, /Column "Test Column 2" doesn't exist/);
});

QUnit.test('Restore a task', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['restore', 'task-1'], kanbn);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Restored task "task-1" from the archive/);
  assert.deepEqual(
    mockConfig.output,
    {
      taskId: 'task-1',
      columnName: null
    }
  );
});

QUnit.test('Restore a task into a custom column', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['restore', 'task-1', '-c', 'Test Column'], kanbn);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Restored task "task-1" from the archive/);
  assert.deepEqual(
    mockConfig.output,
    {
      taskId: 'task-1',
      columnName: 'Test Column'
    }
  );
});
