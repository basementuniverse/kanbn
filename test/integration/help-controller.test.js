const mockArgv = require('mock-argv');
const capture = require('../capture');

let kanbn;

QUnit.module('help controller tests', {
  before() {
    require('../qunit-contains');
    kanbn = require('../../index');
  }
});

QUnit.test('Help with no command should show the general help text', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['help'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Usage:/);
  assert.contains(output, /kanbn <command>/);
});

QUnit.test('Help for a specific command should show that command\'s help text', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['help', 'add'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /kanbn add/);
});

QUnit.test('The --help flag should show help for the command it is used with', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['board', '--help'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /kanbn board/);
});

QUnit.test('The -h alias should show help for the command it is used with', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['sprint', '-h'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /kanbn sprint/);
});

QUnit.test('An unrecognised command should print an error', async assert => {
  const output = await capture.stderr(async out => {
    await mockArgv(['not-a-command'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /"not-a-command" is not a valid command/);
});
