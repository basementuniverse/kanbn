const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');
const context = require('../context');

// The kanbn command that will be called during tests
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
