const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');
const context = require('../context');
const capture = require('../capture');

let kanbn;

QUnit.module('init controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = false;
    mockConfig.output = null;
  }
});

QUnit.test('Initialise kanbn with no options', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  await mockArgv(['init'], kanbn);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Initialised empty kanbn board in test/);
  assert.deepEqual(mockConfig.output, {});
});

QUnit.test('Initialise kanbn with all options', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  await mockArgv(['init', '-n', 'test123', '-d', 'Lorem ipsum dolor sit amet', '-c', 'Column 1', '-c', 'Column 2'], kanbn);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Initialised empty kanbn board in test/);
  assert.deepEqual(
    mockConfig.output,
    {
      name: 'test123',
      description: 'Lorem ipsum dolor sit amet',
      columns: [
        'Column 1',
        'Column 2'
      ]
    }
  );
});

QUnit.test('Reinitialise kanbn with no options', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['init'], kanbn);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Reinitialised existing kanbn board in test/);
  assert.deepEqual(
    mockConfig.output,
    {
      name: mockConfig.index.name,
      description: mockConfig.index.description,
      columns: Object.keys(mockConfig.index.columns)
    }
  );
});

QUnit.test('Reinitialise kanbn with all options', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['init', '-n', 'test123', '-d', 'Lorem ipsum dolor sit amet', '-c', 'Column 1', '-c', 'Column 2'], kanbn);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Reinitialised existing kanbn board in test/);
  assert.deepEqual(
    mockConfig.output,
    {
      name: 'test123',
      description: 'Lorem ipsum dolor sit amet',
      columns: [
        'Column 1',
        'Column 2'
      ]
    }
  );
});

QUnit.test('Initialise kanbn interactively', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['y', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['n', context.keys.enter]
  ]);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Initialised empty kanbn board in test/);
  assert.deepEqual(
    mockConfig.output,
    {
      name: 'Test project name',
      setDescription: false,
      columns: ['Test column name']
    }
  );
});

QUnit.test('Initialise kanbn interactively with an empty project name', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['', context.keys.enter]
  ]);

  assert.contains(output, /Project name cannot be empty/);
  assert.equal(mockConfig.output, null);

  // Answer the rest of the prompt, so it doesn't stay open and swallow the next test's input
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['n', context.keys.enter]
  ]);
  captureConsole.stopIntercept(process.stdout);
});

QUnit.test('Initialise kanbn interactively with an empty column name', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['y', context.keys.enter],
    ['', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['n', context.keys.enter]
  ]);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Column name cannot be empty/);
});

QUnit.test('Initialise kanbn interactively with a duplicate column name', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  await mockArgv(['init', '-i'], kanbn);
  await context.sendInput([
    ['Test project name', context.keys.enter],
    ['n', context.keys.enter],
    ['y', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['y', context.keys.enter],
    ['Test column name', context.keys.enter],
    ['Test column name 2', context.keys.enter],
    ['n', context.keys.enter]
  ]);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, /Column name already exists/);
});

QUnit.test('Reinitialise kanbn interactively should show current title', async assert => {
  const output = [];
  captureConsole.startIntercept(process.stdout, s => {
    output.push(s);
  });

  mockConfig.initialised = true;
  await mockArgv(['init', '-i'], kanbn);

  // Reinitialising skips the column prompts, so this only answers the name and description
  await context.sendInput([
    [context.keys.enter],
    ['n', context.keys.enter]
  ]);

  captureConsole.stopIntercept(process.stdout);
  assert.contains(output, new RegExp(`\(${mockConfig.index.name}\)`));
});

QUnit.test('Create a board with --board', async assert => {
  mockConfig.initialised = true;
  mockConfig.boards = [
    { slug: 'index', path: 'test/index.md', name: 'Test Project', description: '', main: true }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(
      ['init', '-b', 'design', '-n', 'Design Pipeline', '-c', 'Ideas', '-c', 'Designing'],
      kanbn
    );
    await context.sleep(50);
  });

  assert.equal(mockConfig.boardSlug, 'design', 'init should scope itself to the new board');
  assert.contains(output, /Created board "design" in test/);
  assert.deepEqual(mockConfig.output, {
    name: 'Design Pipeline',
    columns: ['Ideas', 'Designing']
  });
});

QUnit.test('Update an existing board with --board', async assert => {
  mockConfig.initialised = true;
  mockConfig.boards = [
    { slug: 'index', path: 'test/index.md', name: 'Test Project', description: '', main: true },
    { slug: 'design', path: 'test/design.md', name: 'Design Pipeline', description: '', main: false }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(['init', '-b', 'design', '-n', 'UX Pipeline'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Updated board "design" in test/);
  assert.equal(mockConfig.output.name, 'UX Pipeline');
});

QUnit.test('Create a board in an uninitialised workspace', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['init', '-b', 'design'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
  assert.equal(mockConfig.output, null);
});

QUnit.test('Create a board with a reserved slug', async assert => {
  mockConfig.initialised = true;
  mockConfig.errors.validateBoardSlug = 'Board slug "main" is reserved';
  const output = await capture.stderr(async () => {
    await mockArgv(['init', '-b', 'main'], kanbn);
    await context.sleep(50);
  });

  assert.contains(output, /Board slug "main" is reserved/);
  assert.equal(mockConfig.output, null);
});
