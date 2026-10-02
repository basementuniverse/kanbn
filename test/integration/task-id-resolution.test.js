const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const mockInquirer = require('../mock-inquirer');
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

QUnit.test('A missing task id should still name the command in the hint', async assert => {
  for (const command of ['task', 'edit', 'move', 'comment', 'archive', 'remove', 'rename']) {
    const errors = await capture.stderr(async () => {
      await mockArgv([command], kanbn);
    });
    assert.contains(errors, new RegExp(`No task id specified[\\s\\S]*kanbn ${command} "task id"`), command);
  }
});

const ARCHIVE = '../src/controller/archive';
const REMOVE = '../src/controller/remove';

/**
 * Run a controller with a fake inquirer and a (pretend) terminal on stdin
 * @param {string} controllerPath The controller to run
 * @param {object} args The parsed command arguments
 * @param {object[]} responses One response object per expected prompt
 * @param {boolean} [tty=true] Whether stdin should look like a terminal
 * @return {Promise<object>} The prompts asked, and everything written to stderr
 */
async function runDestructive(controllerPath, args, responses, tty = true) {
  const { controller, inquirer } = mockInquirer.loadController(controllerPath, responses);
  const wasTTY = process.stdin.isTTY;
  process.stdin.isTTY = tty;
  let errors;
  try {
    errors = await capture.stderr(async () => {
      await capture.stdout(async () => {
        await controller(args);
        await capture.waitFor(() => mockConfig.output !== null, 200);
      });
    });
  } finally {
    process.stdin.isTTY = wasTTY;
  }
  return { prompts: inquirer.questions.flat(), errors };
}

QUnit.module('task id resolution in destructive commands', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.taskExists = true;
    mockConfig.output = null;
    mockConfig.resolvedTaskIds = {
      'test-t': { id: 'test-task-1', match: 'prefix' }
    };
  },
  after() {
    mockInquirer.unloadController(ARCHIVE);
    mockInquirer.unloadController(REMOVE);
  }
});

QUnit.test('Archiving a partial id should ask for confirmation naming the task', async assert => {
  const { prompts } = await runDestructive(ARCHIVE, { _: ['archive', 'test-t'] }, [{ sure: true }]);

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].message, 'Archive task "test-task-1"?');
  assert.equal(prompts[0].default, false);
  assert.deepEqual(mockConfig.output, { taskId: 'test-task-1' });
});

QUnit.test('Declining the confirmation should not archive anything', async assert => {
  await runDestructive(ARCHIVE, { _: ['archive', 'test-t'] }, [{ sure: false }]);

  assert.equal(mockConfig.output, null);
});

QUnit.test('Archiving a partial id with --force should not ask', async assert => {
  const { prompts, errors } = await runDestructive(ARCHIVE, { _: ['archive', 'test-t'], force: true }, []);

  assert.equal(prompts.length, 0);
  assert.contains(errors, /Resolved "test-t" to "test-task-1"/);
  assert.deepEqual(mockConfig.output, { taskId: 'test-task-1' });
});

QUnit.test('Archiving an exact id should not ask', async assert => {
  const { prompts } = await runDestructive(ARCHIVE, { _: ['archive', 'test-task-1'] }, []);

  assert.equal(prompts.length, 0);
  assert.deepEqual(mockConfig.output, { taskId: 'test-task-1' });
});

QUnit.test('Archiving a partial id without a terminal should fail rather than prompt', async assert => {
  const { prompts, errors } = await runDestructive(ARCHIVE, { _: ['archive', 'test-t'] }, [], false);

  assert.equal(prompts.length, 0);
  assert.contains(errors, /"test-t" isn't an exact task id/);
  assert.contains(errors, /--force/);
  assert.equal(mockConfig.output, null);
});

QUnit.test('Removing a partial id should confirm once, naming the task', async assert => {
  const { prompts } = await runDestructive(REMOVE, { _: ['remove', 'test-t'] }, [{ sure: true }]);

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].message, 'Are you sure you want to remove task "test-task-1"?');
  assert.equal(mockConfig.output.taskId, 'test-task-1');
});

QUnit.test('Removing a partial id with --force should not ask', async assert => {
  const { prompts } = await runDestructive(REMOVE, { _: ['remove', 'test-t'], force: true }, []);

  assert.equal(prompts.length, 0);
  assert.equal(mockConfig.output.taskId, 'test-task-1');
});
