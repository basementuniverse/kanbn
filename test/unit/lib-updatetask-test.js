const mockFileSystem = require('mock-fs');
const kanbn = require('../../lib/main');

QUnit.module('Kanbn library createTask tests', {
  before() {
    require('./utility');
  },
  beforeEach() {
    require('./fixtures')({
      columns: 2,
      tasks: 2,
      randomiseColumns: false
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Update task in un-initialised folder', async assert => {

  // Refresh the filesystem to un-initialise kanbn
  mockFileSystem();

  // Try to update a task without initialising kanbn
  assert.throwsAsync(
    async () => {
      await kanbn.updateTask('task-1', {});
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Update non-existent task', async assert => {

  // Try to update a non-existent task
  assert.throwsAsync(
    async () => {
      await kanbn.updateTask('task-3', {});
    },
    /No task file found with id "task-3"/
  );
});

QUnit.test('Update an untracked task', async assert => {

  // Create a mock index and untracked task
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Test Column 1',
      'tasks': {
        'test-task.md': '# Test Task'
      }
    }
  });

  // Try to update an untracked task
  assert.throwsAsync(
    async () => {
      await kanbn.updateTask('test-task', {});
    },
    /Task "test-task" is not in the index/
  );
});

QUnit.test('Update a task with a blank name', async assert => {

  // Try to update a task with empty data
  assert.throwsAsync(
    async () => {
      await kanbn.updateTask('task-1', {});
    },
    /Task name cannot be blank/
  );
});

QUnit.test('Rename a task', async assert => {

  // Get the first task
  const task = await kanbn.getTask('task-1');

  // Update task
  await kanbn.updateTask('task-1', { name: 'Task 3' });

  // Verify that the task file and index were updated
  let taskUpdated = false;
  try {
    await kanbn.taskExists('task-3');
    taskUpdated = true;
  } catch (error) {}
  assert.equal(taskUpdated, true);
});

QUnit.test('Rename a task to a name that already exists', async assert => {

  // Get the first task
  const task = await kanbn.getTask('task-1');

  // Try to update a task with a duplicate name
  assert.throwsAsync(
    async () => {
      await kanbn.updateTask('task-1', { name: 'Task 2' });
    },
    /A task with id "task-2" already exists/
  );
});

QUnit.test('Update a task', async assert => {
  const TEST_DESCRIPTION = 'Test description...';
  const TEST_TAGS = ['Tag 1', 'Tag 2'];
  const TEST_SUB_TASK = {
    text: 'Test sub-task',
    completed: true
  };
  const TEST_RELATION = {
    task: 'task-2',
    type: 'Test relation type'
  };

  // Get the first task
  let task = await kanbn.getTask('task-1');

  // Update task
  const currentDate = (new Date()).toISOString();
  await kanbn.updateTask('task-1', {
    name: task.name,
    description: TEST_DESCRIPTION,
    metadata: {
      tags: TEST_TAGS
    },
    subTasks: [
      TEST_SUB_TASK
    ],
    relations: [
      TEST_RELATION
    ]
  });

  // Verify that the task file was updated
  task = await kanbn.getTask('task-1');
  assert.equal(task.description, TEST_DESCRIPTION);
  assert.equal(task.metadata.updated.substr(0, 9), currentDate.substr(0, 9));
  assert.deepEqual(task.metadata.tags, TEST_TAGS);
  assert.deepEqual(task.subTasks, [TEST_SUB_TASK]);
  assert.deepEqual(task.relations, [TEST_RELATION]);
});

QUnit.test('Move a task', async assert => {

  // Get the first task
  const task = await kanbn.getTask('task-1');

  // Update task
  await kanbn.updateTask('task-1', task, 'Column 2');

  // Verify that the index was updated
  const tasks = await kanbn.findTrackedTasks('Column 2');
  assert.equal(tasks.has('task-1'), true);
});
