const mockArgv = require('mock-argv');
const CaptureStdOut = require('capture-stdout');

const mockRequire = require('mock-require');
mockRequire('../../commands/version', args => { console.log('wibble'); });
const index = require('../../index');

QUnit.module('test');

QUnit.test('test', async assert => {
  assert.expect(0);

  const output = new CaptureStdOut();
  output.startCapture();

  mockArgv(['v'], index);

  output.stopCapture();
  console.log(`test123: ${output.getCapturedText()}`);
});
