const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const parseIndex = require('../../src/parse-index');
const parseTask = require('../../src/parse-task');

QUnit.module('gantt tests', {
  before() {
    require('../qunit-throws-async');
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Gantt should respect dependency order and postponed dates', async assert => {
  const createdA = new Date('2026-01-01T00:00:00.000Z');
  const createdB = new Date('2026-01-02T00:00:00.000Z');
  const postponedB = new Date('2026-01-10T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {},
        columns: {
          Backlog: ['task-a', 'task-b']
        }
      }),
      tasks: {
        'task-a.md': parseTask.json2md({
          name: 'task a',
          description: '',
          metadata: {
            created: createdA
          },
          subTasks: [],
          relations: [],
          comments: []
        }),
        'task-b.md': parseTask.json2md({
          name: 'task b',
          description: '',
          metadata: {
            created: createdB,
            postponed: postponedB
          },
          subTasks: [],
          relations: [
            {
              type: 'depends-on',
              task: 'task-a'
            }
          ],
          comments: []
        })
      }
    }
  });

  const result = await kanbn.gantt();

  assert.deepEqual(result.tasks.map(task => task.id), ['task-a', 'task-b']);
  assert.equal(result.tasks[1].dependencies[0], 'task-a');
  assert.equal(result.tasks[1].start.toISOString(), postponedB.toISOString());
  assert.ok(result.tasks[1].start >= result.tasks[0].end);
});

QUnit.test('Gantt should reject dependency cycles', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {},
        columns: {
          Backlog: ['task-a', 'task-b']
        }
      }),
      tasks: {
        'task-a.md': parseTask.json2md({
          name: 'task a',
          description: '',
          metadata: {
            created: new Date('2026-01-01T00:00:00.000Z')
          },
          subTasks: [],
          relations: [
            {
              type: 'depends-on',
              task: 'task-b'
            }
          ],
          comments: []
        }),
        'task-b.md': parseTask.json2md({
          name: 'task b',
          description: '',
          metadata: {
            created: new Date('2026-01-02T00:00:00.000Z')
          },
          subTasks: [],
          relations: [
            {
              type: 'depends-on',
              task: 'task-a'
            }
          ],
          comments: []
        })
      }
    }
  });

  await assert.throwsAsync(
    async () => {
      await kanbn.gantt();
    },
    /dependency cycle detected/
  );
});
