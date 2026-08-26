const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const yaml = require('yamljs');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('status controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.statusData = {
      name: 'Test Project',
      tasks: 2,
      columnTasks: {
        'Column 1': 1,
        'Column 2': 1
      }
    };
  }
});

QUnit.test('Status without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['status'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Status with an invalid date should print a parse error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['status', '-d', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse date/);
});

QUnit.test('Status should print the status as YAML', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['status'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(yaml.parse(output.join('')), mockConfig.statusData);
});

QUnit.test('Status with the json flag should print the status as JSON', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['status', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(JSON.parse(output.join('')), mockConfig.statusData);
});

QUnit.test('Status should pass parsed CLI arguments to kanbn.status', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['status', '-q', '-u', '-e', '-p', 'Sprint 1'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.quiet, true);
  assert.strictEqual(mockConfig.output.untracked, true);
  assert.strictEqual(mockConfig.output.due, true);
  assert.strictEqual(mockConfig.output.sprint, 'Sprint 1');
  assert.strictEqual(mockConfig.output.dates, null);
});

QUnit.test('A numeric sprint argument should be passed through as a number', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['status', '-p', '2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.sprint, 2);
});

QUnit.test('Date arguments should be parsed into dates', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['status', '-d', '2026-01-01', '-d', '2026-01-31'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.dates.length, 2);
  assert.strictEqual(mockConfig.output.dates[0].toISOString().substr(0, 10), '2026-01-01');
  assert.strictEqual(mockConfig.output.dates[1].toISOString().substr(0, 10), '2026-01-31');
});

QUnit.test('Quiet untracked status should print untracked task ids', async assert => {
  mockConfig.statusData = ['test-task-1', 'test-task-2'];
  const output = await capture.stdout(async out => {
    await mockArgv(['status', '-q', '-u'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(output.join('').trim(), 'test-task-1\ntest-task-2');
});

QUnit.test('Quiet untracked status with no untracked tasks should say so', async assert => {
  mockConfig.statusData = [];
  const output = await capture.stdout(async out => {
    await mockArgv(['status', '-q', '-u'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /No untracked tasks found/);
});

QUnit.test('Status should hint about tasks whose dates disagree with their column', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Column 2',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['status'], kanbn);
    await capture.waitFor(() => out.some(s => /dates that don't match/.test(s)));
  });

  assert.contains(output, /1 task has dates that don't match its column/);
});

QUnit.test('The date drift hint should be suppressed for JSON output', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Column 2',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['status', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
    await context.sleep(100);
  });

  assert.strictEqual(output.join('').indexOf("dates that don't match"), -1);
});
