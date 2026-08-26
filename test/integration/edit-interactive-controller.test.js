const mockRequire = require('mock-require');
const capture = require('../capture');
const mockInquirer = require('../mock-inquirer');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

const CONTROLLER = '../src/controller/edit';

let editController, fakeInquirer;

/**
 * Load the edit controller with a fake inquirer that answers with the given responses
 * @param {object} responses The answers to give
 */
function withAnswers(responses) {
  ({ controller: editController, inquirer: fakeInquirer } = mockInquirer.loadController(
    CONTROLLER,
    [responses]
  ));
}

/**
 * Run the edit controller interactively and return the task data it saved
 * @param {object} responses The answers to give
 * @param {object} [args={}] Extra CLI arguments
 * @return {Promise<object>} The output recorded by the mock kanbn library
 */
async function editInteractively(responses, args = {}) {
  withAnswers(responses);
  await capture.stdout(async out => {
    await editController({ _: ['edit', 'test-task-1'], interactive: true, ...args });
    await capture.waitFor(() => mockConfig.output !== null);
  });
  return mockConfig.output;
}

QUnit.module('edit controller interactive tests', {
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
    mockConfig.trackedTasks = ['test-task-1', 'test-task-2'];
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1'],
        'Column 2': []
      },
      options: {}
    };
    mockConfig.task = {
      name: 'Test Task 1',
      description: 'Test description',
      metadata: {
        due: new Date('2026-01-01T00:00:00.000Z'),
        assigned: 'Alex',
        tags: ['existing-tag']
      },
      subTasks: [
        { text: 'Existing sub-task', completed: false }
      ],
      relations: [
        { task: 'test-task-2', type: 'blocks' }
      ],
      comments: []
    };
  },
  after() {
    mockInquirer.unloadController(CONTROLLER);
  }
});

QUnit.test('Answering with the defaults should leave the task unchanged', async assert => {
  const output = await editInteractively({});

  assert.strictEqual(output.taskData.name, 'Test Task 1');
  assert.strictEqual(output.taskData.description, 'Test description');
  assert.deepEqual(output.taskData.metadata.tags, ['existing-tag']);
  assert.deepEqual(output.taskData.subTasks, [{ text: 'Existing sub-task', completed: false }]);
  assert.deepEqual(output.taskData.relations, [{ task: 'test-task-2', type: 'blocks' }]);
  assert.strictEqual(output.columnName, null, 'the task stays in its column');
});

QUnit.test('An empty task name should be rejected', async assert => {
  withAnswers({ name: '' });

  const output = await capture.stderr(async out => {
    await editController({ _: ['edit', 'test-task-1'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Task name cannot be empty/);
  assert.strictEqual(mockConfig.output, null);
});

QUnit.test('Editing the name and description', async assert => {
  const output = await editInteractively({
    name: 'New name',
    editDescription: true,
    description: 'New description'
  });

  assert.strictEqual(output.taskData.name, 'New name');
  assert.strictEqual(output.taskData.description, 'New description');
});

QUnit.test('Choosing a different column should move the task', async assert => {
  const output = await editInteractively({ column: 'Column 2' });

  assert.strictEqual(output.columnName, 'Column 2');
});

QUnit.test('Editing the due date', async assert => {
  const output = await editInteractively({
    editDue: 'edit',
    due: new Date('2026-06-01T00:00:00.000Z')
  });

  assert.strictEqual(output.taskData.metadata.due.toISOString(), '2026-06-01T00:00:00.000Z');
});

QUnit.test('Removing the due date', async assert => {
  const output = await editInteractively({ editDue: 'remove' });

  assert.strictEqual('due' in output.taskData.metadata, false);
});

QUnit.test('Setting a due date when the task has none', async assert => {
  delete mockConfig.task.metadata.due;
  const output = await editInteractively({
    setDue: true,
    due: new Date('2026-06-01T00:00:00.000Z')
  });

  assert.strictEqual(output.taskData.metadata.due.toISOString(), '2026-06-01T00:00:00.000Z');
});

QUnit.test('Removing the assigned user', async assert => {
  const output = await editInteractively({ editAssigned: 'remove' });

  assert.strictEqual('assigned' in output.taskData.metadata, false);
});

QUnit.test('Editing the assigned user', async assert => {
  const output = await editInteractively({ editAssigned: 'edit', assigned: 'Sam' });

  assert.strictEqual(output.taskData.metadata.assigned, 'Sam');
});

QUnit.test('Adding sub-tasks', async assert => {
  const output = await editInteractively({
    addSubTasks: [
      { text: 'First new sub-task', completed: true },
      { text: 'Second new sub-task' }
    ]
  });

  assert.deepEqual(output.taskData.subTasks, [
    { text: 'Existing sub-task', completed: false },
    { text: 'First new sub-task', completed: true },
    { text: 'Second new sub-task', completed: false }
  ]);
});

QUnit.test('Adding a sub-task with empty text should be rejected', async assert => {
  withAnswers({ addSubTasks: [{ text: '' }] });

  const output = await capture.stderr(async out => {
    await editController({ _: ['edit', 'test-task-1'], interactive: true });
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Sub-task text cannot be empty/);
});

QUnit.test('Editing a sub-task completion status', async assert => {
  const output = await editInteractively({
    editSubTasks: [
      {
        selectSubTask: 'Existing sub-task',
        editSubTask: 'edit',
        completed: true
      }
    ]
  });

  assert.deepEqual(output.taskData.subTasks, [{ text: 'Existing sub-task', completed: true }]);
});

QUnit.test('Removing a sub-task', async assert => {
  const output = await editInteractively({
    editSubTasks: [
      {
        selectSubTask: 'Existing sub-task',
        editSubTask: 'remove'
      }
    ]
  });

  assert.deepEqual(output.taskData.subTasks, []);
});

QUnit.test('Doing nothing to a sub-task should leave it alone', async assert => {
  const output = await editInteractively({
    editSubTasks: [
      {
        selectSubTask: 'Existing sub-task',
        editSubTask: 'none'
      }
    ]
  });

  assert.deepEqual(output.taskData.subTasks, [{ text: 'Existing sub-task', completed: false }]);
});

QUnit.test('Adding tags', async assert => {
  const output = await editInteractively({
    addTags: [{ name: 'new-tag' }]
  });

  assert.deepEqual(output.taskData.metadata.tags, ['existing-tag', 'new-tag']);
});

QUnit.test('Removing tags', async assert => {
  const output = await editInteractively({
    removeTags: [{ selectTag: 'existing-tag' }]
  });

  assert.deepEqual(output.taskData.metadata.tags, []);
});

QUnit.test('Adding a relation', async assert => {
  const output = await editInteractively({
    addRelations: [{ task: 'test-task-3', type: 'requires' }]
  });

  assert.deepEqual(output.taskData.relations, [
    { task: 'test-task-2', type: 'blocks' },
    { task: 'test-task-3', type: 'requires' }
  ]);
});

QUnit.test('Editing a relation type', async assert => {
  const output = await editInteractively({
    editRelations: [
      {
        selectRelation: 'test-task-2',
        editRelation: 'edit',
        type: 'duplicates'
      }
    ]
  });

  assert.deepEqual(output.taskData.relations, [{ task: 'test-task-2', type: 'duplicates' }]);
});

QUnit.test('The relation type prompt should default to the current type', async assert => {
  const output = await editInteractively({
    editRelations: [
      {
        selectRelation: 'test-task-2',
        editRelation: 'edit'
      }
    ]
  });

  assert.deepEqual(output.taskData.relations, [{ task: 'test-task-2', type: 'blocks' }]);
});

QUnit.test('Removing a relation', async assert => {
  const output = await editInteractively({
    editRelations: [
      {
        selectRelation: 'test-task-2',
        editRelation: 'remove'
      }
    ]
  });

  assert.deepEqual(output.taskData.relations, []);
});

QUnit.test('Prompts for values the task does not have should be skipped', async assert => {
  mockConfig.task.metadata = {};
  mockConfig.task.subTasks = [];
  mockConfig.task.relations = [];
  await editInteractively({});

  const names = fakeInquirer.questions[0].map(question => question.name);
  assert.strictEqual(names.indexOf('editDue') !== -1, true, 'the due date prompt is defined');

  // The prompts that only apply to existing values are defined but not asked
  assert.strictEqual(names.indexOf('editSubTasks') !== -1, true);
  assert.strictEqual(names.indexOf('editRelations') !== -1, true);
});

QUnit.test('Unset arguments should still be applied when editing interactively', async assert => {
  const output = await editInteractively({}, { unset: 'assigned' });

  assert.deepEqual(output.unsetFields, ['assigned']);
});
