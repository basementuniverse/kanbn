const mockRequire = require('mock-require');
const capture = require('../capture');
const mockInquirer = require('../mock-inquirer');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

const CONTROLLER = '../src/controller/add';

let addController;

/**
 * Load the add controller with a fake inquirer that answers with the given responses
 * @param {object} responses The answers to give
 */
function withAnswers(responses) {
  ({ controller: addController } = mockInquirer.loadController(CONTROLLER, [responses]));
}

/**
 * Run the add controller interactively and return the task data it created
 * @param {object} responses The answers to give
 * @param {object} [args={}] Extra CLI arguments
 * @return {Promise<object>} The output recorded by the mock kanbn library
 */
async function addInteractively(responses, args = {}) {
  withAnswers(responses);
  await capture.stdout(async () => {
    await addController({ _: ['add'], interactive: true, ...args });
    await capture.waitFor(() => mockConfig.output !== null);
  });
  return mockConfig.output;
}

QUnit.module('add controller interactive tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.trackedTasks = ['test-task-1'];
    mockConfig.untrackedTasks = [];
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': [],
        'Column 2': []
      },
      options: {}
    };
  },
  after() {
    mockInquirer.unloadController(CONTROLLER);
  }
});

QUnit.test('Create a task interactively with just a name', async assert => {
  const output = await addInteractively({ name: 'Interactive task', column: 'Column 1' });

  assert.strictEqual(output.taskData.name, 'Interactive task');
  assert.strictEqual(output.columnName, 'Column 1');
});

QUnit.test('An empty task name should be rejected', async assert => {
  withAnswers({ name: '' });

  const output = await capture.stderr(async out => {
    await addController({ _: ['add'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Task name cannot be empty/);
  assert.strictEqual(mockConfig.output, null);
});

QUnit.test('Create a task interactively with a description', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    setDescription: true,
    description: 'Interactive description'
  });

  assert.strictEqual(output.taskData.description, 'Interactive description');
});

QUnit.test('Declining the description prompt should skip it', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    setDescription: false
  });

  assert.strictEqual('description' in output.taskData, false);
});

QUnit.test('Create a task interactively with dates', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    setDue: true,
    due: new Date('2026-06-01T00:00:00.000Z'),
    setPlannedStart: true,
    plannedStart: new Date('2026-05-01T00:00:00.000Z'),
    setPlannedFinish: true,
    plannedFinish: new Date('2026-05-31T00:00:00.000Z')
  });

  assert.strictEqual(output.taskData.metadata.due.toISOString(), '2026-06-01T00:00:00.000Z');
  assert.strictEqual(output.taskData.metadata.plannedStart.toISOString(), '2026-05-01T00:00:00.000Z');
  assert.strictEqual(output.taskData.metadata.plannedFinish.toISOString(), '2026-05-31T00:00:00.000Z');
});

QUnit.test('Create a task interactively with an assigned user', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    setAssigned: true,
    assigned: 'Alex'
  });

  assert.strictEqual(output.taskData.metadata.assigned, 'Alex');
});

QUnit.test('Create a task interactively with sub-tasks', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    subTasks: [
      { text: 'First sub-task', completed: true },
      { text: 'Second sub-task' }
    ]
  });

  assert.deepEqual(output.taskData.subTasks, [
    { text: 'First sub-task', completed: true },
    { text: 'Second sub-task', completed: false }
  ]);
});

QUnit.test('A sub-task with empty text should be rejected', async assert => {
  withAnswers({ name: 'Interactive task', subTasks: [{ text: '' }] });

  const output = await capture.stderr(async out => {
    await addController({ _: ['add'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Sub-task text cannot be empty/);
});

QUnit.test('Create a task interactively with tags', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    tags: [{ name: 'one' }, { name: 'two' }]
  });

  assert.deepEqual(output.taskData.metadata.tags, ['one', 'two']);
});

QUnit.test('A tag with an empty name should be rejected', async assert => {
  withAnswers({ name: 'Interactive task', tags: [{ name: '' }] });

  const output = await capture.stderr(async out => {
    await addController({ _: ['add'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Tag name cannot be empty/);
});

QUnit.test('Answering with no tags should leave tags off the task', async assert => {
  const output = await addInteractively({ name: 'Interactive task', tags: [] });

  assert.strictEqual('tags' in output.taskData.metadata, false);
});

QUnit.test('Create a task interactively with relations', async assert => {
  const output = await addInteractively({
    name: 'Interactive task',
    relations: [{ task: 'test-task-1', type: 'blocks' }]
  });

  assert.deepEqual(output.taskData.relations, [{ task: 'test-task-1', type: 'blocks' }]);
});

QUnit.test('The relations prompt should be skipped when there are no other tasks', async assert => {
  mockConfig.trackedTasks = [];
  const output = await addInteractively({
    name: 'Interactive task',
    relations: [{ task: 'test-task-1', type: 'blocks' }]
  });

  assert.strictEqual('relations' in output.taskData, false);
});

QUnit.test('Add untracked tasks interactively', async assert => {
  mockConfig.untrackedTasks = ['untracked-1', 'untracked-2'];
  withAnswers({
    untrackedTasks: ['untracked-1'],
    column: 'Column 2'
  });

  const output = await capture.stdout(async out => {
    await addController({ _: ['add'], interactive: true, untracked: true });
    await capture.waitFor(() => mockConfig.output !== null);
    return out;
  });

  assert.contains(output, /Added 1 task to column "Column 2"/);
  assert.deepEqual(mockConfig.output, {
    untrackedTask: 'untracked-1',
    columnName: 'Column 2'
  });
});
