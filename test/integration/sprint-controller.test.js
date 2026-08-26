const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('sprint controller tests', {
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

QUnit.test('Start a sprint without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['sprint'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Start a sprint with no name should pass an empty name through', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['sprint'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Started new sprint "Test Sprint" at 2026-01-01T00:00:00\.000Z/);
  assert.strictEqual(mockConfig.output.name, '');
  assert.strictEqual(mockConfig.output.description, '');
});

QUnit.test('Start a sprint with a name and description', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sprint', '-n', 'Sprint 1', '-d', 'Sprint description'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.name, 'Sprint 1');
  assert.strictEqual(mockConfig.output.description, 'Sprint description');
});

QUnit.test('Start a sprint should pass the current date as the start date', async assert => {
  const before = new Date();
  await capture.stdout(async out => {
    await mockArgv(['sprint', '-n', 'Sprint 1'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.equal(mockConfig.output.start instanceof Date, true);
  assert.equal(mockConfig.output.start.getTime() >= before.getTime(), true);
});

QUnit.test('Start a sprint interactively', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['sprint', '-i'], kanbn);
    await context.sendInput([
      ['Interactive Sprint', context.keys.enter],
      ['n', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /Started new sprint/.test(s)));
  });

  assert.contains(output, /Started new sprint/);
  assert.strictEqual(mockConfig.output.name, 'Interactive Sprint');
  assert.strictEqual(mockConfig.output.description, '');
});

QUnit.test('Start a sprint interactively with an empty name should show a validation error', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['sprint', '-i'], kanbn);
    await context.sendInput([
      ['', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /cannot be empty/.test(s)));

    // Answer the rest of the prompt, so it doesn't stay open and swallow the next test's input
    await context.sendInput([
      ['Valid Sprint', context.keys.enter],
      ['n', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /Started new sprint/.test(s)));
  });

  assert.contains(output, /Sprint name cannot be empty/);
  assert.strictEqual(mockConfig.output.name, 'Valid Sprint');
});
