const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('validate controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.validateResult = true;
    mockConfig.dateDrift = [];
    mockConfig.fixedDateDrift = [];
  }
});

QUnit.test('Validate in uninitialised folder should print an error', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['validate'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Validate with no problems should print "Everything OK"', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Everything OK/);
  assert.deepEqual(mockConfig.output, { save: false });
});

QUnit.test('Validate should report lines in columns that are not task links', async assert => {
  mockConfig.columnContentWarnings = [
    {
      board: 'index',
      column: 'Column 1',
      type: 'non-task-line',
      text: 'Buy milk',
      message: 'column "Column 1" contains a line that isn\'t a task link: - Buy milk'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 line in a column isn't a task link/);
  assert.contains(output, /Column 1: Buy milk/);
});

QUnit.test('Validate should report a line that looks like a malformed task link', async assert => {
  mockConfig.columnContentWarnings = [
    {
      board: 'index',
      column: 'Column 1',
      type: 'malformed-task-link',
      text: '[test-task-1](tasks/test-task-1.md',
      message: 'column "Column 1" contains a line that looks like a malformed task link'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 line looks like a .*malformed task link/);
});

QUnit.test('Validate should report a line naming a task file that exists', async assert => {
  mockConfig.columnContentWarnings = [
    {
      board: 'index',
      column: 'Column 1',
      type: 'untracked-task-line',
      text: 'test-task-1',
      message: 'column "Column 1" contains a line naming a task file that exists'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 line names a task file that exists/);
  assert.contains(output, /Column 1: test-task-1/);
});

QUnit.test('Validate with the json flag should carry column content warnings', async assert => {
  mockConfig.columnContentWarnings = [
    {
      board: 'index',
      column: 'Column 1',
      type: 'non-task-line',
      text: 'Buy milk',
      message: 'column "Column 1" contains a line that isn\'t a task link: - Buy milk'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const result = JSON.parse(output);
  assert.deepEqual(result.drift, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].type, 'non-task-line');
});

QUnit.test('Validate with the fix flag should still report column content warnings', async assert => {
  mockConfig.columnContentWarnings = [
    {
      board: 'index',
      column: 'Column 1',
      type: 'malformed-task-link',
      text: '[test-task-1](tasks/test-task-1.md',
      message: 'column "Column 1" contains a line that looks like a malformed task link'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--fix'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /malformed task link/);
});

QUnit.test('Validate with the save flag should pass save to kanbn.validate', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['validate', '--save'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output, { save: true });
});

QUnit.test('Validate with errors should print the errors', async assert => {
  mockConfig.validateResult = [
    {
      task: 'test-task-1',
      errors: 'Unable to parse task: data is missing a name heading'
    }
  ];
  const output = await capture.stderr(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 errors found in task files/);
  assert.contains(output, /test-task-1/);
});

QUnit.test('Validate with errors and the json flag should print the errors as JSON', async assert => {
  mockConfig.validateResult = [
    {
      task: 'test-task-1',
      errors: 'Unable to parse task: data is missing a name heading'
    }
  ];
  const output = await capture.stderr(async out => {
    await mockArgv(['validate', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const json = output.join('').substring(output.join('').indexOf('['));
  assert.deepEqual(JSON.parse(json), mockConfig.validateResult);
});

QUnit.test('Validate should report tasks whose dates disagree with their column', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Done',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 task has dates that don't match its column/);
  assert.contains(output, /test-task-1: is in a completed column but has no completed date/);
  assert.contains(output, /kanbn validate --fix/);
});

QUnit.test('Validate with the json flag should print date drift as JSON', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Done',
      issue: 'missing',
      field: 'completed',
      fixable: true,
      message: 'is in a completed column but has no completed date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(JSON.parse(output.join('')), mockConfig.dateDrift);
});

QUnit.test('Validate with the fix flag and nothing to fix should print "nothing to fix"', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--fix'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Everything OK, nothing to fix/);
});

QUnit.test('Validate with the fix flag should report the dates it filled in', async assert => {
  mockConfig.fixedDateDrift = [
    {
      task: 'test-task-1',
      field: 'completed',
      date: new Date('2026-01-01T00:00:00.000Z'),
      source: 'updated date'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--fix'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Filled in 1 missing date/);
  assert.contains(output, /test-task-1: completed set to 2026-01-01T00:00:00\.000Z \(from updated date\)/);
});

QUnit.test('A failure while validating should print the error', async assert => {
  mockConfig.errors.validate = 'Not initialised in this folder';

  const output = await capture.stderr(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Not initialised in this folder/);
});

QUnit.test('A failure while looking for date drift should print the error', async assert => {
  mockConfig.errors.findDateDrift = 'Unable to load tasks';

  const output = await capture.stderr(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Unable to load tasks/);
});

QUnit.test('A failure while fixing date drift should print the error', async assert => {
  mockConfig.errors.fixDateDrift = 'Unable to save tasks';

  const output = await capture.stderr(async out => {
    await mockArgv(['validate', '--fix'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Unable to save tasks/);
});

QUnit.test('Validate with the fix flag and the json flag should print the fixed dates as JSON', async assert => {
  mockConfig.fixedDateDrift = [
    {
      task: 'test-task-1',
      field: 'completed',
      date: new Date('2026-01-01T00:00:00.000Z'),
      source: 'updated date'
    }
  ];

  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--fix', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const fixed = JSON.parse(output.join(''));
  assert.strictEqual(fixed.length, 1);
  assert.strictEqual(fixed[0].task, 'test-task-1');
});

QUnit.test('Drift that cannot be fixed should not suggest the fix flag', async assert => {
  mockConfig.dateDrift = [
    {
      task: 'test-task-1',
      column: 'Backlog',
      issue: 'unexpected',
      field: 'completed',
      fixable: false,
      message: 'has a completed date but is not in a completed column'
    }
  ];

  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 task has dates that don't match its column/);
  assert.strictEqual(output.join('').indexOf('--fix'), -1);
});

QUnit.test('Validate should report names that are not known contributors', async assert => {
  mockConfig.contributorWarnings = [
    { task: 'test-task-1', type: 'unknown-contributor', value: 'Gordon', message: '"Gordon" isn\'t a known contributor' },
    { task: 'test-task-2', type: 'unknown-contributor', value: 'Gordon', message: '"Gordon" isn\'t a known contributor' }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /1 name is used in tasks but isn't a known contributor/);
  assert.contains(output, /Gordon: test-task-1, test-task-2/);
  assert.contains(output, /kanbn contributors --usage/);
});

QUnit.test('Validate should include contributor warnings in JSON output', async assert => {
  mockConfig.contributorWarnings = [
    { task: 'test-task-1', type: 'unknown-contributor', value: 'Gordon', message: '"Gordon" isn\'t a known contributor' }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['validate', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const result = JSON.parse(output.join(''));
  assert.deepEqual(result.warnings, mockConfig.contributorWarnings);
});

QUnit.test('Validate with no contributor warnings should say everything is OK', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['validate'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Everything OK/);
});
