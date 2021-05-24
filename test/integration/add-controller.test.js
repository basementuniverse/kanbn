const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
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
