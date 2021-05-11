const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const CaptureStdOut = require('capture-stdout');
const context = require('../context');

const TEST_MAIN_FOLDER_NAME = 'test';
const TEST_INDEX = {
  name: 'Test Project',
  description: 'Test description',
  columns: {
    'Test Column': [
      'test-task-1'
    ]
  }
};

// Globally-accessible mocked kanbn library
let kanbn;

// Last output from mock kanbn library
let mockInitialiseOutput;

// Mock kanbn library
const mockKanbn = {
  mockInitialised: false,
  async initialised() {
    return this.mockInitialised;
  },
  async getMainFolder() {
    return TEST_MAIN_FOLDER_NAME;
  },
  async initialise(options = {}) {
    mockInitialiseOutput = options;
  },
  async getIndex() {
    return TEST_INDEX;
  }
};

QUnit.module('init controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockInitialiseOutput = null;
  }
});

QUnit.test('Initialise kanbn with no options', async assert => {

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init'], kanbn);

  // Check output
  output.stopCapture();
  assert.deepEqual(mockInitialiseOutput, {});
  assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
});

QUnit.test('Initialise kanbn with all options', async assert => {

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-n', 'test123', '-d', 'Test description', '-c', 'Column 1', '-c', 'Column 2'], kanbn);

  // Check output
  output.stopCapture();
  assert.deepEqual(
    mockInitialiseOutput,
    {
      name: 'test123',
      description: 'Test description',
      columns: [
        'Column 1',
        'Column 2'
      ]
    }
  );
  assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
});

QUnit.test('Re-initialise kanbn with no options', async assert => {

  // Set kanbn to initialised state
  mockKanbn.mockInitialised = true;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init'], kanbn);

  // Check output
  output.stopCapture();
  assert.deepEqual(
    mockInitialiseOutput,
    {
      name: 'Test Project',
      description: 'Test description',
      columns: [
        'Test Column'
      ]
    }
  );
  assert.contains(output.getCapturedText(), 'Reinitialised existing kanbn board in test');
});

QUnit.test('Re-initialise kanbn with all options', async assert => {

  // Set kanbn to initialised state
  mockKanbn.mockInitialised = true;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-n', 'test123', '-d', 'Test description', '-c', 'Column 1', '-c', 'Column 2'], kanbn);

  // Check output
  output.stopCapture();
  assert.deepEqual(
    mockInitialiseOutput,
    {
      name: 'test123',
      description: 'Test description',
      columns: [
        'Column 1',
        'Column 2'
      ]
    }
  );
  assert.contains(output.getCapturedText(), 'Reinitialised existing kanbn board in test');
});

QUnit.test('Interactive kanbn interactively', async assert => {

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['y', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['n', context.keys.enter]
  ]);

  // Check output
  output.stopCapture();
  assert.deepEqual(
    mockInitialiseOutput,
    {
      name: 'Test project name',
      setDescription: false,
      columns: ['Test column name']
    }
  );
  assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
});

QUnit.test('Initialise kanbn interactively with an empty project name', async assert => {

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['', context.keys.enter]
  ]);

  // Check output
  output.stopCapture();
  assert.equal(mockInitialiseOutput, null);
  assert.contains(output.getCapturedText(), /Project name cannot be empty/);
});

QUnit.test('Initialise kanbn interactively with an empty column name', async assert => {

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['y', context.keys.enter],
    ['', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['n', context.keys.enter]
  ]);

  // Check output
  output.stopCapture();
  assert.contains(output.getCapturedText(), /Column name cannot be empty/);
});

QUnit.test('Initialise kanbn interactively with a duplicate column name', async assert => {

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['y', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['y', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['Test column name 2', context.keys.enter],
    ['n', context.keys.enter]
  ]);

  // Check output
  output.stopCapture();
  assert.contains(output.getCapturedText(), /Column name already exists/);
});

// TODO reinitialise interactively tests
