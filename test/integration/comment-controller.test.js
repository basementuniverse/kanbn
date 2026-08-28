const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const context = require('../context');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('comment controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.taskExists = true;
    mockConfig.output = null;
  }
});

QUnit.test('Add a comment without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['comment', 'test-task-1'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Add a comment with no task id specified', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['comment'], kanbn);
  });

  assert.contains(output, /No task id specified/);
});

QUnit.test('Add a comment to a task that does not exist', async assert => {
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['comment', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('Add a comment', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['comment', 'test-task-1', '-t', 'Test comment'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Added comment to task "test-task-1"/);
  assert.strictEqual(mockConfig.output.taskId, 'test-task-1');
  assert.strictEqual(mockConfig.output.text, 'Test comment');
});

QUnit.test('Add a comment with no author should default to the current user', async assert => {
  mockConfig.currentUser = 'gordon';
  await capture.stdout(async out => {
    await mockArgv(['comment', 'test-task-1', '-t', 'Test comment'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.author, 'gordon');
});

QUnit.test('Add a comment on a machine with no current user should leave the author empty', async assert => {

  // A null author used to be written straight into the comment, which failed schema validation and
  // left the task unwritable
  mockConfig.currentUser = null;
  await capture.stdout(async out => {
    await mockArgv(['comment', 'test-task-1', '-t', 'Test comment'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.author, '');
});

QUnit.test('Add a comment with an author', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['comment', 'test-task-1', '-t', 'Test comment', '-a', 'Test Author'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.author, 'Test Author');
});

QUnit.test('Add a comment interactively', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['comment', 'test-task-1', '-i'], kanbn);
    await context.sendInput([
      ['Interactive comment', context.keys.enter],
      ['Interactive Author', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /Added comment/.test(s)));
  });

  assert.contains(output, /Added comment to task "test-task-1"/);
  assert.strictEqual(mockConfig.output.text, 'Interactive comment');
  assert.strictEqual(mockConfig.output.author, 'Interactive Author');
});

QUnit.test('Add a comment interactively with empty text should show a validation error', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['comment', 'test-task-1', '-i'], kanbn);
    await context.sendInput([
      ['', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /cannot be empty/.test(s)));

    // Answer the rest of the prompt, so it doesn't stay open and swallow the next test's input
    await context.sendInput([
      ['Valid comment', context.keys.enter],
      ['Test Author', context.keys.enter]
    ]);
    await capture.waitFor(() => out.some(s => /Added comment/.test(s)));
  });

  assert.contains(output, /Comment text cannot be empty/);
  assert.strictEqual(mockConfig.output.text, 'Valid comment');
});
