const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('sort controller tests', {
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
        'Column 1': [],
        'Column 2': []
      },
      options: {}
    };
  }
});

QUnit.test('Sort with no column name and no interactive flag should print an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['sort'], kanbn);
  });

  assert.contains(output, /No column name specified/);
});

QUnit.test('Sort when there are no columns in the index', async assert => {
  mockConfig.index.columns = {};
  const output = await capture.stderr(async () => {
    await mockArgv(['sort', 'Column 1'], kanbn);
  });

  assert.contains(output, /No columns defined in the index/);
});

QUnit.test('Sort a column that does not exist', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['sort', 'Column 3'], kanbn);
  });

  assert.contains(output, /Column "Column 3" doesn't exist/);
});

QUnit.test('Sort a column with no sorters', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Column "Column 1" sorted/);
  assert.deepEqual(mockConfig.output, {
    columnName: 'Column 1',
    sorters: [],
    save: false
  });
});

QUnit.test('Sort a column by a single field', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1', '--name'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.sorters, [
    { field: 'name', filter: '', order: 'ascending' }
  ]);
});

QUnit.test('Sort a column by a field with a filter', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1', '--tag', 'urgent'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.sorters, [
    { field: 'tags', filter: 'urgent', order: 'ascending' }
  ]);
});

QUnit.test('Sort a column by a field in descending order', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1', '--due', '-z'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.sorters, [
    { field: 'due', filter: '', order: 'descending' }
  ]);
});

QUnit.test('A leading order flag should set the default order for every sorter', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1', '-z', '--name', '--due'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.sorters, [
    { field: 'name', filter: '', order: 'descending' },
    { field: 'due', filter: '', order: 'descending' }
  ]);
});

QUnit.test('Sort a column by several fields', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1', '--name', '-a', '--workload', '-z'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output.sorters, [
    { field: 'name', filter: '', order: 'ascending' },
    { field: 'workload', filter: '', order: 'descending' }
  ]);
});

QUnit.test('Sort a column with the save flag', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['sort', 'Column 1', '--name', '--save'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.save, true);
  assert.deepEqual(mockConfig.output.sorters, [
    { field: 'name', filter: '', order: 'ascending' }
  ]);
});

QUnit.test('Sort a column interactively', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['sort', '-i'], kanbn);
    await context.sendInput([
      ['1', context.keys.enter],
      [context.keys.enter],
      ['n', context.keys.enter],
      [context.keys.enter],
      ['n', context.keys.enter],
      ['n', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /sorted/.test(s)));
  });

  assert.contains(output, /Column "Column 1" sorted/);
  assert.strictEqual(mockConfig.output.columnName, 'Column 1');
  assert.strictEqual(mockConfig.output.save, false);
});
