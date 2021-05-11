const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const mockStdIn = require('mock-stdin').stdin();
const CaptureStdOut = require('capture-stdout');

let mockInitialiseOutput = null;
let kanbn;

// Mock kanbn library
const mockKanbn = {
  mockInitialised: false,
  async initialised() {
    return this.mockInitialised;
  },
  async getMainFolder() {
    return 'test';
  },
  async initialise(options = {}) {
    mockInitialiseOutput = options;
  },
  async getIndex() {
    return {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Test Column': [
          'test-task-1'
        ]
      }
    };
  }
};

// Key codes
const keys = {
  up: '\x1B\x5B\x41',
  down: '\x1B\x5B\x42',
  enter: '\x0D',
  space: '\x20'
};

QUnit.module('init controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  }
});

// QUnit.test('Initialise kanbn with no options', async assert => {

//   // Set kanbn to un-initialised state
//   mockKanbn.mockInitialised = false;

//   // Start capturing output
//   const output = new CaptureStdOut();
//   output.startCapture();

//   // Call initialise command
//   await mockArgv(['init'], index);

//   // Check output
//   output.stopCapture();
//   assert.deepEqual(
//     JSON.parse(output.getCapturedText()[0]),
//     {}
//   );
//   assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
// });

// QUnit.test('Initialise kanbn with all options', async assert => {

//   // Set kanbn to un-initialised state
//   mockKanbn.mockInitialised = false;

//   // Start capturing output
//   const output = new CaptureStdOut();
//   output.startCapture();

//   // Call initialise command
//   await mockArgv(['init', '-n', 'test123', '-d', 'Test description', '-c', 'Column 1', '-c', 'Column 2'], index);

//   // Check output
//   output.stopCapture();
//   assert.deepEqual(
//     JSON.parse(output.getCapturedText()[0]),
//     {
//       name: 'test123',
//       description: 'Test description',
//       columns: [
//         'Column 1',
//         'Column 2'
//       ]
//     }
//   );
//   assert.contains(output.getCapturedText(), 'Initialised empty kanbn board in test');
// });

// QUnit.test('Re-initialise kanbn with no options', async assert => {

//   // Set kanbn to initialised state
//   mockKanbn.mockInitialised = true;

//   // Start capturing output
//   const output = new CaptureStdOut();
//   output.startCapture();

//   // Call initialise command
//   await mockArgv(['init'], index);

//   // Check output
//   output.stopCapture();
//   assert.deepEqual(
//     JSON.parse(output.getCapturedText()[0]),
//     {
//       name: 'Test Project',
//       description: 'Test description',
//       columns: [
//         'Test Column'
//       ]
//     }
//   );
//   assert.contains(output.getCapturedText(), 'Reinitialised existing kanbn board in test');
// });

// QUnit.test('Re-initialise kanbn with all options', async assert => {

//   // Set kanbn to initialised state
//   mockKanbn.mockInitialised = true;

//   // Start capturing output
//   const output = new CaptureStdOut();
//   output.startCapture();

//   // Call initialise command
//   await mockArgv(['init', '-n', 'test123', '-d', 'Test description', '-c', 'Column 1', '-c', 'Column 2'], index);

//   // Check output
//   output.stopCapture();
//   assert.deepEqual(
//     JSON.parse(output.getCapturedText()[0]),
//     {
//       name: 'test123',
//       description: 'Test description',
//       columns: [
//         'Column 1',
//         'Column 2'
//       ]
//     }
//   );
//   assert.contains(output.getCapturedText(), 'Reinitialised existing kanbn board in test');
// });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

QUnit.test('Test interactive initialisation', async assert => {
  assert.expect(0);

  // Set kanbn to un-initialised state
  mockKanbn.mockInitialised = false;

  // Start capturing output
  const output = new CaptureStdOut();
  output.startCapture();

  // Call initialise command
  await mockArgv(['init', '-i'], kanbn);

  mockStdIn.send(['hello', keys.enter]);

  await sleep(50);

  mockStdIn.send(['n', keys.enter]);

  await sleep(50);

  mockStdIn.send(['n', keys.enter]);

  await sleep(50);

  output.stopCapture();

  console.log(mockInitialiseOutput);
});
