const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');
const gitUser = require('../../src/git-user');

// Real temporary directories rather than mock-fs, so archiving really moves the task file into the
// archive folder the way the CLI does
const roots = [];
const realGitUser = { name: gitUser.name, email: gitUser.email };

/**
 * Create a workspace where task-b blocks task-a and task-c depends on it
 * @return {Promise<Kanbn>}
 */
async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-archived-relations-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({ name: 'Test Project', columns: ['Todo', 'Done'] });
  await kanbn.createTask({ name: 'Task A', metadata: { created: new Date('2026-01-01T00:00:00.000Z') } }, 'Todo');
  await kanbn.createTask({
    name: 'Task B',
    metadata: { created: new Date('2026-01-02T00:00:00.000Z') },
    relations: [{ type: 'blocks', task: 'task-a' }]
  }, 'Todo');
  await kanbn.createTask({
    name: 'Task C',
    metadata: { created: new Date('2026-01-03T00:00:00.000Z') },
    relations: [{ type: 'depends-on', task: 'task-a' }]
  }, 'Todo');
  return kanbn;
}

QUnit.module('archived relations tests', {
  before() {
    gitUser.name = () => null;
    gitUser.email = () => null;
  },
  after() {
    Object.assign(gitUser, realGitUser);
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('Gantt should not fail when a related task has been archived', async assert => {
  const kanbn = await setup();
  await kanbn.archiveTask('task-a');

  const result = await kanbn.gantt();
  assert.deepEqual(result.tasks.map(task => task.id).sort(), ['task-b', 'task-c']);
  for (const task of result.tasks) {
    assert.deepEqual(task.dependencies, []);
    assert.deepEqual(task.externalIncomingDependencies, []);
    assert.deepEqual(task.externalOutgoingDependents, []);
    assert.false(task.blocked);
  }
});

QUnit.test('Archiving should keep relations so restoring a task restores its place in the gantt', async assert => {
  const kanbn = await setup();
  await kanbn.archiveTask('task-a');
  assert.deepEqual((await kanbn.getTask('task-b')).relations, [{ type: 'blocks', task: 'task-a' }]);
  assert.deepEqual((await kanbn.getTask('task-c')).relations, [{ type: 'depends-on', task: 'task-a' }]);

  await kanbn.restoreTask('task-a');
  const result = await kanbn.gantt();
  const byId = new Map(result.tasks.map(task => [task.id, task]));
  assert.deepEqual(byId.get('task-a').dependencies, ['task-b']);
  assert.deepEqual(byId.get('task-c').dependencies, ['task-a']);
});

QUnit.test('Gantt should not fail when a related task does not exist at all', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Task D', relations: [{ type: 'depends-on', task: 'no-such-task' }] }, 'Todo');
  await kanbn.createTask({ name: 'Task E', relations: [{ type: 'blocks', task: 'no-such-task' }] }, 'Todo');

  const result = await kanbn.gantt();
  const byId = new Map(result.tasks.map(task => [task.id, task]));
  assert.deepEqual(byId.get('task-d').dependencies, []);
  assert.deepEqual(byId.get('task-e').externalOutgoingDependents, []);
});

QUnit.test('findRelationWarnings should not report relations to archived tasks', async assert => {
  const kanbn = await setup();
  await kanbn.archiveTask('task-a');
  assert.deepEqual(await kanbn.findRelationWarnings(), []);
});

QUnit.test('findRelationWarnings should report relations to missing tasks and to the task itself', async assert => {
  const kanbn = await setup();
  await kanbn.deleteTask('task-a', true);
  await kanbn.createTask({ name: 'Task D', relations: [{ type: '', task: 'task-d' }] }, 'Todo');

  const warnings = await kanbn.findRelationWarnings();
  assert.deepEqual(
    warnings.map(warning => [warning.task, warning.type, warning.relation.task]),
    [
      ['task-b', 'missing-related-task', 'task-a'],
      ['task-c', 'missing-related-task', 'task-a'],
      ['task-d', 'self-relation', 'task-d']
    ]
  );
  assert.equal(warnings[0].message, '"blocks task-a" points at a task that doesn\'t exist');
  assert.equal(warnings[2].message, '"task-d" relates the task to itself');
});
