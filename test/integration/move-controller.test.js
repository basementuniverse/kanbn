const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('move controller tests', {
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
  }
});

QUnit.test('Move a task without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Move a task with no task id specified', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['move'], kanbn);
  });

  assert.contains(output, /No task id specified/);
});

QUnit.test('Move a task that does not exist', async assert => {
  mockConfig.taskExists = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No task file found with id "test-task-1"/);
});

QUnit.test('Move a simple task to another column', async assert => {
  mockConfig.taskExists = false;
  mockConfig.simpleTasks = [{ column: 'Column 1', position: 1, text: 'Buy milk', raw: '- Buy milk' }];
  const output = await capture.stdout(async out => {
    await mockArgv(['move', 'Buy milk', '-c', 'Column 2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Moved simple task "Buy milk" to column "Column 2"/);
  assert.deepEqual(mockConfig.output, { simpleTask: 'Buy milk', column: 'Column 2', position: null });
});

QUnit.test('Move a simple task found by its slugified title', async assert => {
  mockConfig.taskExists = false;
  mockConfig.simpleTasks = [{ column: 'Column 1', position: 1, text: 'Buy milk', raw: '- Buy milk' }];
  const output = await capture.stdout(async out => {
    await mockArgv(['move', 'buy-milk', '-c', 'Column 2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Moved simple task "Buy milk"/);
});

QUnit.test('Move a simple task with no column should leave it where it is', async assert => {
  mockConfig.taskExists = false;
  mockConfig.simpleTasks = [{ column: 'Column 1', position: 1, text: 'Buy milk', raw: '- Buy milk' }];
  await capture.stdout(async out => {
    await mockArgv(['move', 'Buy milk'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output, { simpleTask: 'Buy milk', column: 'Column 1', position: null });
});

QUnit.test('Moving an ambiguous simple task should list the candidates', async assert => {
  mockConfig.taskExists = false;
  mockConfig.simpleTasks = [
    { column: 'Column 1', position: 1, text: 'Buy milk', raw: '- Buy milk' },
    { column: 'Column 2', position: 0, text: 'Buy milk', raw: '- Buy milk' }
  ];
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'Buy milk', '-c', 'Column 2'], kanbn);
  });

  assert.contains(output, /matches 2 simple tasks/);
  assert.contains(output, /in column "Column 1"/);
});

QUnit.test('A real task should win over a simple task with the same title', async assert => {
  mockConfig.taskExists = true;
  mockConfig.simpleTasks = [{ column: 'Column 1', position: 1, text: 'test-task-1', raw: '- test-task-1' }];
  const output = await capture.stdout(async out => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Moved task "test-task-1" to column "Column 2"/);
});

QUnit.test('Move a task when there are no columns in the index', async assert => {
  mockConfig.index = {
    name: 'Test Project',
    description: 'Test description',
    columns: {},
    options: {}
  };
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1'], kanbn);
  });

  assert.contains(output, /No columns defined in the index/);
});

QUnit.test('Move a task to a column that does not exist', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 3'], kanbn);
  });

  assert.contains(output, /Column "Column 3" doesn't exist/);
});

QUnit.test('Move a task with a non-numeric position', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2', '-p', 'not-a-number'], kanbn);
  });

  assert.contains(output, /Position value must be numeric/);
});

QUnit.test('Move a task to another column', async assert => {
  const output = await capture.stdout(async out => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Moved task "test-task-1" to column "Column 2"/);
  assert.deepEqual(mockConfig.output, {
    taskId: 'test-task-1',
    columnName: 'Column 2',
    position: null,
    relative: false,
    add: true
  });
});

QUnit.test('Move a task to a position in another column', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2', '-p', '2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output, {
    taskId: 'test-task-1',
    columnName: 'Column 2',
    position: 2,
    relative: false,
    add: true
  });
});

QUnit.test('Move a task to a relative position', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['move', 'test-task-1', '-p', '1', '-r'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.deepEqual(mockConfig.output, {
    taskId: 'test-task-1',
    columnName: 'Column 1',
    position: 1,
    relative: true,
    add: true
  });
});

QUnit.test('Move a task with no column specified should keep it in its current column', async assert => {
  await capture.stdout(async out => {
    await mockArgv(['move', 'test-task-1', '-p', '2'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.strictEqual(mockConfig.output.columnName, 'Column 1');
});

// Interactive tests load the controller with a fake inquirer, rather than driving the real prompts
// over stdin, so the prompt definitions themselves get exercised
const mockInquirer = require('../mock-inquirer');

const MOVE_CONTROLLER = '../src/controller/move';

QUnit.module('move controller interactive tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
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
        'Column 2': ['test-task-3']
      },
      options: {}
    };
  },
  after() {
    mockInquirer.unloadController(MOVE_CONTROLLER);
  }
});

/**
 * Run the move controller interactively
 * @param {object} responses The answers to give
 * @param {object} [args={}] Extra CLI arguments
 * @return {Promise<object>} The output recorded by the mock kanbn library
 */
async function moveInteractively(responses, args = {}) {
  const { controller } = mockInquirer.loadController(MOVE_CONTROLLER, [responses]);
  await capture.stdout(async () => {
    await controller({ _: ['move', 'test-task-1'], interactive: true, ...args });
    await capture.waitFor(() => mockConfig.output !== null);
  });
  return mockConfig.output;
}

QUnit.test('Move a task interactively', async assert => {
  const output = await moveInteractively({ column: 'Column 2', position: 1 });

  assert.strictEqual(output.taskId, 'test-task-1');
  assert.strictEqual(output.columnName, 'Column 2');
  assert.strictEqual(output.position, 1);
  assert.strictEqual(output.relative, false, 'interactive moves are always absolute');
});

QUnit.test('The interactive column prompt should default to the task\'s current column', async assert => {
  const { controller, inquirer } = mockInquirer.loadController(MOVE_CONTROLLER, [{ position: 0 }]);
  await capture.stdout(async () => {
    await controller({ _: ['move', 'test-task-1'], interactive: true });
    await capture.waitFor(() => mockConfig.output !== null);
  });

  const columnPrompt = inquirer.questions[0].find(question => question.name === 'column');
  assert.strictEqual(columnPrompt.default, 'Column 1');
  assert.deepEqual(columnPrompt.choices, ['Column 1', 'Column 2']);
});

QUnit.test('The interactive position prompt should not offer the task being moved', async assert => {
  const { controller, inquirer } = mockInquirer.loadController(MOVE_CONTROLLER, [{ column: 'Column 1', position: 0 }]);
  await capture.stdout(async () => {
    await controller({ _: ['move', 'test-task-1'], interactive: true });
    await capture.waitFor(() => mockConfig.output !== null);
  });

  const positionPrompt = inquirer.questions[0].find(question => question.name === 'position');
  assert.deepEqual(await positionPrompt.choices({ column: 'Column 1' }), ['test-task-2']);
});

QUnit.test('The interactive position prompt should be skipped for sorted columns', async assert => {
  mockConfig.index.options.columnSorting = {
    'Column 2': [{ field: 'name', filter: '', order: 'ascending' }]
  };
  const { controller, inquirer } = mockInquirer.loadController(MOVE_CONTROLLER, [{ column: 'Column 2' }]);
  await capture.stdout(async () => {
    await controller({ _: ['move', 'test-task-1'], interactive: true });
    await capture.waitFor(() => mockConfig.output !== null);
  });

  const positionPrompt = inquirer.questions[0].find(question => question.name === 'position');
  assert.strictEqual(await positionPrompt.when({ column: 'Column 2' }), false);
  assert.strictEqual(mockConfig.output.position, null, 'the task keeps its sorted position');
});

QUnit.test('A relative position argument should be resolved before prompting', async assert => {
  const { controller, inquirer } = mockInquirer.loadController(MOVE_CONTROLLER, [{ column: 'Column 1', position: 0 }]);
  await capture.stdout(async () => {
    await controller({ _: ['move', 'test-task-2'], interactive: true, position: '1', relative: true });
    await capture.waitFor(() => mockConfig.output !== null);
  });

  // test-task-2 is at position 1 in Column 1, so a relative move of 1 defaults the prompt to 2
  const positionPrompt = inquirer.questions[0].find(question => question.name === 'position');
  assert.strictEqual(await positionPrompt.default({ column: 'Column 1' }), 2);
});
