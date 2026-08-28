const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('find controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1']
      },
      options: {}
    };
    mockConfig.searchResults = [];
  }
});

QUnit.test('Find without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['find'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Find when there are no columns in the index', async assert => {
  mockConfig.index.columns = {};
  const output = await capture.stderr(async () => {
    await mockArgv(['find'], kanbn);
  });

  assert.contains(output, /No columns defined in the index/);
});

QUnit.test('Find with no filters should pass an empty filter set', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['find'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Found 0 tasks/);
  assert.deepEqual(mockConfig.output.filters, {});
});

QUnit.test('Find with string filters should pass them through', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['find', '-n', 'Test', '-c', 'Column 1'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.filters, {
    name: 'Test',
    column: 'Column 1'
  });
});

QUnit.test('Find with "@me" as the assigned filter should expand it to the current user', async assert => {
  mockConfig.currentUser = 'gordon';
  await capture.stdout(async out => {
    await mockArgv(['find', '--assigned', '@me'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.filters, { assigned: 'gordon' });
});

QUnit.test('Find with "@me" among several assigned filters should expand only that one', async assert => {
  mockConfig.currentUser = 'gordon';
  await capture.stdout(async out => {
    await mockArgv(['find', '--assigned', '@me', '--assigned', 'dave'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.filters, { assigned: ['gordon', 'dave'] });
});

QUnit.test('Find with "@me" and no current user should print an error', async assert => {
  mockConfig.currentUser = null;
  const output = await capture.stderr(async () => {
    await mockArgv(['find', '--assigned', '@me'], kanbn);
  });

  assert.contains(output, /Unable to work out who you are/);
  assert.strictEqual(mockConfig.output, null);
});

QUnit.test('Find with a repeated filter should collect the values into an array', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['find', '-t', 'one', '-t', 'two'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.filters, { tag: ['one', 'two'] });
});

QUnit.test('Find with a numeric filter should convert it to a number', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['find', '--count-tags', '3'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.filters, { 'count-tags': 3 });
});

QUnit.test('Find with a non-numeric count filter should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['find', '--count-tags', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Count tags filter value must be numeric/);
});

QUnit.test('Find with a date filter should convert it to a date', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['find', '--due', '2026-01-01'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.equal(mockConfig.output.filters.due instanceof Date, true);
  assert.strictEqual(mockConfig.output.filters.due.toISOString().substr(0, 10), '2026-01-01');
});

QUnit.test('Find with an unparseable date filter should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['find', '--due', 'not-a-date'], kanbn);
  });

  assert.contains(output, /Unable to parse due date/);
});

QUnit.test('Find should print matching tasks', async assert => {
  mockConfig.searchResults = [
    {
      id: 'test-task-1',
      name: 'Test Task 1',
      description: 'Test description',
      column: 'Column 1'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['find'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Found 1 task/);
  assert.contains(output, /test-task-1/);
  assert.contains(output, /Test Task 1/);
});

QUnit.test('Find with the quiet flag should print task ids only', async assert => {
  mockConfig.searchResults = ['test-task-1', 'test-task-2'];
  const output = await capture.stdout(async out => {
    await mockArgv(['find', '-q'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.quiet, true);
  assert.strictEqual(output.join('').trim(), 'test-task-1\ntest-task-2');
});

QUnit.test('Find with the json flag should print results as JSON', async assert => {
  mockConfig.searchResults = [
    {
      id: 'test-task-1',
      name: 'Test Task 1'
    }
  ];
  const output = await capture.stdout(async out => {
    await mockArgv(['find', '--json'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(JSON.parse(output.join('')), mockConfig.searchResults);
});

QUnit.test('Find with a custom field filter should be type checked', async assert => {
  mockConfig.index.options.customFields = [
    {
      name: 'points',
      type: 'number'
    }
  ];
  const output = await capture.stderr(async () => {
    await mockArgv(['find', '--points', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Custom field "points" value is not a number/);
});

// Interactive tests load the controller with a fake inquirer, rather than driving the real prompts
// over stdin, so the prompt definitions themselves get exercised
const mockInquirer = require('../mock-inquirer');

const FIND_CONTROLLER = '../src/controller/find';

QUnit.module('find controller interactive tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.searchResults = [];
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1']
      },
      options: {}
    };
  },
  after() {
    mockInquirer.unloadController(FIND_CONTROLLER);
  }
});

/**
 * Run the find controller interactively
 *
 * The controller prompts twice: once to collect filters, then once for the output options
 * @param {object[]} filters The filters to give, as {type, value} pairs
 * @param {object} [outputOptions={}] The answers to the output option prompts
 * @return {Promise<object>} The output recorded by the mock kanbn library
 */
async function findInteractively(filters, outputOptions = {}) {
  const { controller } = mockInquirer.loadController(FIND_CONTROLLER, [
    { filters },
    outputOptions
  ]);
  await capture.stdout(async () => {
    await controller({ _: ['find'], interactive: true });
    await capture.waitFor(() => mockConfig.output !== null);
  });
  return mockConfig.output;
}

QUnit.test('Find interactively with a string filter', async assert => {
  const output = await findInteractively([
    { type: 'Name', value: 'Test' }
  ]);

  assert.deepEqual(output.filters, { name: 'Test' });
});

QUnit.test('Find interactively with several filters', async assert => {
  const output = await findInteractively([
    { type: 'Name', value: 'Test' },
    { type: 'Column', value: 'Column 1' }
  ]);

  assert.deepEqual(output.filters, { name: 'Test', column: 'Column 1' });
});

QUnit.test('Repeating a filter interactively should collect the values into an array', async assert => {
  const output = await findInteractively([
    { type: 'Tags', value: 'one' },
    { type: 'Tags', value: 'two' },
    { type: 'Tags', value: 'three' }
  ]);

  assert.deepEqual(output.filters, { tag: ['one', 'two', 'three'] });
});

QUnit.test('An empty string filter value should be rejected', async assert => {
  const { controller } = mockInquirer.loadController(FIND_CONTROLLER, [
    { filters: [{ type: 'Name', value: '' }] },
    {}
  ]);

  const output = await capture.stderr(async out => {
    await controller({ _: ['find'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Filter value cannot be empty/);
  assert.strictEqual(mockConfig.output, null);
});

QUnit.test('An unparseable date filter value should be rejected', async assert => {
  const { controller } = mockInquirer.loadController(FIND_CONTROLLER, [
    { filters: [{ type: 'Due', value: 'not-a-date' }] },
    {}
  ]);

  const output = await capture.stderr(async out => {
    await controller({ _: ['find'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Unable to parse date/);
});

QUnit.test('A non-numeric number filter value should be rejected', async assert => {
  const { controller } = mockInquirer.loadController(FIND_CONTROLLER, [
    { filters: [{ type: 'Count tags', value: 'not-a-number' }] },
    {}
  ]);

  const output = await capture.stderr(async out => {
    await controller({ _: ['find'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Filter value must be numeric/);
});

QUnit.test('Answering the output prompts should control quiet and json', async assert => {
  const output = await findInteractively(
    [{ type: 'Name', value: 'Test' }],
    { nonquiet: false, json: true }
  );

  assert.strictEqual(output.quiet, true);
});

QUnit.test('Choosing full task details should search non-quietly', async assert => {
  const output = await findInteractively(
    [{ type: 'Name', value: 'Test' }],
    { nonquiet: true, json: false }
  );

  assert.strictEqual(output.quiet, false);
});
