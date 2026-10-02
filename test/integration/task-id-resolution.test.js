const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('task id resolution tests', {
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
    mockConfig.taskColumn = 'Column 1';
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1', 'test-task-2'],
        'Column 2': []
      },
      options: {}
    };
    mockConfig.resolvedTaskIds = {
      'test-t': { id: 'test-task-1', match: 'prefix' }
    };
  }
});

QUnit.test('A partial id should be resolved and the resolution reported on stderr', async assert => {
  let output;
  const errors = await capture.stderr(async () => {
    output = await capture.stdout(async out => {
      await mockArgv(['move', 'test-t', '-c', 'Column 2'], kanbn);
      await capture.waitFor(() => out.length > 0);
    });
  });

  assert.contains(errors, /Resolved "test-t" to "test-task-1"/);
  assert.contains(output, /Moved task "test-task-1" to column "Column 2"/);
  assert.equal(mockConfig.output.taskId, 'test-task-1');
});

QUnit.test('An exact id should be used without reporting a resolution', async assert => {
  const errors = await capture.stderr(async () => {
    await capture.stdout(async out => {
      await mockArgv(['move', 'test-task-1', '-c', 'Column 2'], kanbn);
      await capture.waitFor(() => out.length > 0);
    });
  });

  assert.notOk(errors.some(line => /Resolved/.test(line)));
  assert.equal(mockConfig.output.taskId, 'test-task-1');
});

QUnit.test('An ambiguous id should list the candidates', async assert => {
  mockConfig.errors.resolveTaskId = 'Task id "test" is ambiguous, it could be:\n  test-task-1\n  test-task-2';
  const errors = await capture.stderr(async () => {
    await mockArgv(['task', 'test'], kanbn);
  });

  assert.contains(errors, /Task id "test" is ambiguous/);
  assert.contains(errors, /test-task-2/);
});

QUnit.test('A simple task matching the input should win over a partial id', async assert => {
  mockConfig.taskExists = false;
  mockConfig.resolvedTaskIds = { 'buy-milk': { id: 'buy-milk-online', match: 'prefix' } };
  mockConfig.simpleTasks = [{ column: 'Column 1', position: 1, text: 'Buy milk', raw: '- Buy milk' }];
  const errors = await capture.stderr(async () => {
    await mockArgv(['task', 'buy-milk'], kanbn);
  });

  assert.contains(errors, /"Buy milk" is a simple task in column "Column 1"/);
  assert.notOk(errors.some(line => /Resolved/.test(line)));
});

QUnit.test('Destructive commands should not resolve a partial id', async assert => {
  mockConfig.taskExists = false;
  for (const command of ['archive', 'remove']) {
    const errors = await capture.stderr(async () => {
      await mockArgv([command, 'test-t'], kanbn);
    });
    assert.contains(errors, /No task file found with id "test-t"/, command);
    assert.equal(mockConfig.output, null, command);
  }
});

QUnit.test('A missing task id should still name the command in the hint', async assert => {
  for (const command of ['task', 'edit', 'move', 'comment', 'archive', 'remove', 'rename']) {
    const errors = await capture.stderr(async () => {
      await mockArgv([command], kanbn);
    });
    assert.contains(errors, new RegExp(`No task id specified[\\s\\S]*kanbn ${command} "task id"`), command);
  }
});
