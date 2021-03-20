const mockArgv = require('mock-argv');
const mockRequire = require('mock-require');
const CaptureStdOut = require('capture-stdout');

// Mock kanbn library
const mockKanbn = {
  async initialised() {
    return false;
  },
  getMainFolder() {
    return 'test';
  },
  async initialise(options = {}) {
    console.log(JSON.stringify(options));
  }
};

QUnit.module('init controller tests', {
  before() {
    require('../qunit-contains');
  }
});

QUnit.test('Initialise kanbn with no options', async assert => {

  // Mock kanbn library
  mockRequire('../../src/main', mockKanbn);
  const index = require('../../index');

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init'], index);

  // Check output
  output.stopCapture();
  assert.deepEqual(
    JSON.parse(output.getCapturedText()[0]),
    {}
  );
  assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
});

QUnit.test('Initialise kanbn with all options', async assert => {

  // Mock kanbn library
  mockRequire('../../src/main', mockKanbn);
  const index = require('../../index');

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-n', 'test123', '-d', 'Test description', '-c', 'Column 1', '-c', 'Column 2'], index);

  // Check output
  output.stopCapture();
  assert.deepEqual(
    JSON.parse(output.getCapturedText()[0]),
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
