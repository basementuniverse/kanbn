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
              type: 'depends on',
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

QUnit.test('Gantt should handle dependency cycles without throwing', async assert => {
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

  const result = await kanbn.gantt();

  assert.equal(result.tasks.length, 2);
  assert.deepEqual(result.tasks.map(task => task.id).sort(), ['task-a', 'task-b']);
  assert.ok(result.tasks.every(task => task.start instanceof Date));
});

QUnit.test('Gantt should treat blocks relation as an inverse dependency', async assert => {
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
              type: 'blocks',
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
          relations: [],
          comments: []
        })
      }
    }
  });

  const result = await kanbn.gantt();
  const taskA = result.tasks.find(task => task.id === 'task-a');
  const taskB = result.tasks.find(task => task.id === 'task-b');

  assert.ok(taskA.start <= taskB.start);
  assert.deepEqual(taskB.dependencies, ['task-a']);
});

QUnit.test('Gantt single-date filter should use mocked now date', async assert => {
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
            created: new Date('2026-01-10T00:00:00.000Z')
          },
          subTasks: [],
          relations: [],
          comments: []
        }),
        'task-b.md': parseTask.json2md({
          name: 'task b',
          description: '',
          metadata: {
            created: new Date('2026-02-10T00:00:00.000Z')
          },
          subTasks: [],
          relations: [],
          comments: []
        })
      }
    }
  });

  const fromDate = new Date('2026-01-01T00:00:00.000Z');
  const mockedNow = new Date('2026-01-31T00:00:00.000Z');
  const result = await kanbn.gantt(null, null, [fromDate], mockedNow);

  assert.deepEqual(result.tasks.map(task => task.id), ['task-a']);
});
