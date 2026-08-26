const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('remove-all controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
  }
});

QUnit.test('Remove all without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['remove-all'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Remove all with the force flag should not prompt for confirmation', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['remove-all', '-f'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /kanbn has been removed/);
  assert.deepEqual(mockConfig.output, { removeAll: true });
});

QUnit.test('Remove all should remove kanbn when the prompt is confirmed', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['remove-all'], kanbn);
    await context.sendInput([['y', context.keys.enter]]);
    await capture.waitFor(() => out.some(s => /kanbn has been removed/.test(s)));
  });

  assert.contains(output, /kanbn has been removed/);
  assert.deepEqual(mockConfig.output, { removeAll: true });
});

QUnit.test('Remove all should do nothing when the prompt is declined', async assert => {
  await capture.stdout(async () => {
    await mockArgv(['remove-all'], kanbn);
    await context.sendInput([['n', context.keys.enter]]);
    await context.sleep(100);
  });

  assert.strictEqual(mockConfig.output, null);
});
