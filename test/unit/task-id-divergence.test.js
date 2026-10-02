const mockFileSystem = require('../real-fs');
const kanbn = require('../../src/main');

// A task whose name has been edited by hand, so the id its name would produce ("zebra-renamed") is
// not the id the index links to ("old-id")
function workspace() {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Todo\n\n- [old-id](tasks/old-id.md)\n- [b-task](tasks/b-task.md)\n',
      'tasks': {
        'old-id.md': '# Zebra renamed\n',
        'b-task.md': '# B task\n'
      }
    }
  });
}

QUnit.module('task id divergence tests', {
  beforeEach() {
    workspace();
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('A loaded task should carry the id it was loaded by, not one derived from its name', async assert => {
  assert.equal((await kanbn.getTask('old-id')).id, 'old-id');
});

QUnit.test('Quiet search should return the ids the index links to', async assert => {
  assert.deepEqual(await kanbn.search({}, true), ['old-id', 'b-task']);
});

QUnit.test('Search should find the column of a task whose name has drifted', async assert => {
  const results = await kanbn.search({ column: 'Todo' });
  assert.deepEqual(results.map(task => [task.id, task.column]), [['old-id', 'Todo'], ['b-task', 'Todo']]);
});

QUnit.test('Sorting should not write ids derived from task names into the index', async assert => {
  await kanbn.sort('Todo', [{ field: 'name', order: 'ascending' }]);
  assert.deepEqual((await kanbn.getIndex()).columns.Todo, ['b-task', 'old-id']);
});

QUnit.test('An archived task should carry the id it was archived under', async assert => {
  await kanbn.archiveTask('old-id');
  assert.equal((await kanbn.loadArchivedTask('old-id')).id, 'old-id');
});
