const mockArgv = require('mock-argv');
const mockRequire = require('mock-require');
const CaptureStdOut = require('capture-stdout');

QUnit.module('Command initialise tests', {
  before() {
    require('../qunit-contains');
  }
});

QUnit.test('Initialise kanbn with no options', async assert => {

  // Mock kanbn library
  mockRequire('../../lib/main', {
    async initialised() {
      return false;
    },
    getMainFolder() {
      return 'test';
    },
    async initialise(options = {}) {
      console.log(options);
    }
  });
  const index = require('../../index');

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-n', 'test123'], index);

  // Check output
  output.stopCapture();
  assert.contains(output.getCapturedText(), "{ name: 'test123' }");
  assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
});
