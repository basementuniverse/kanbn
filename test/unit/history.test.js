const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const parseIndex = require('../../src/parse-index');
const parseTask = require('../../src/parse-task');

QUnit.module('history tests', {
  before() {
    require('../qunit-throws-async');
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('History should merge metadata and structured history in chronological order', async assert => {
  const created = new Date('2026-01-01T00:00:00.000Z');
  const updated = new Date('2026-01-02T00:00:00.000Z');
  const moved = new Date('2026-01-03T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {},
        columns: {
          Backlog: [],
          'In Progress': ['task-1']
        }
      }),
      tasks: {
        'task-1.md': parseTask.json2md({
          name: 'Task 1',
          description: '',
          metadata: {
            created,
            updated,
            assigned: 'Alex'
          },
          subTasks: [],
          relations: [],
          history: [
            {
              type: 'moved',
              date: moved,
              fromColumn: 'Backlog',
              toColumn: 'In Progress'
            }
          ]
        })
      }
    }
  });

  const result = await kanbn.history(null, null, 'Alex', ['task-1']);

  assert.equal(result.events.length, 3);
  assert.equal(result.events[0].source, 'metadata');
  assert.equal(result.events[0].eventType, 'created');
  assert.equal(result.events[1].eventType, 'updated');
  assert.equal(result.events[2].source, 'history');
  assert.equal(result.events[2].eventType, 'moved');
});

QUnit.test('History should filter events using sprint ranges', async assert => {
  const sprintOneEvent = new Date('2026-01-02T00:00:00.000Z');
  const sprintTwoEvent = new Date('2026-01-12T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {
          sprints: [
            { name: 'Sprint 1', start: new Date('2026-01-01T00:00:00.000Z') },
            { name: 'Sprint 2', start: new Date('2026-01-10T00:00:00.000Z') }
          ]
        },
        columns: {
          Backlog: ['task-1']
        }
      }),
      tasks: {
        'task-1.md': parseTask.json2md({
          name: 'Task 1',
          description: '',
          metadata: {
            created: sprintOneEvent,
            updated: sprintTwoEvent
          },
          subTasks: [],
          relations: []
        })
      }
    }
  });

  const sprintOneResult = await kanbn.history([1], null, null, null);
  assert.equal(sprintOneResult.events.length, 1);
  assert.equal(sprintOneResult.events[0].eventType, 'created');

  const sprintTwoResult = await kanbn.history(['Sprint 2'], null, null, null);
  assert.equal(sprintTwoResult.events.length, 1);
  assert.equal(sprintTwoResult.events[0].eventType, 'updated');
});

QUnit.test('History should filter events using a date range', async assert => {
  const created = new Date('2026-01-01T00:00:00.000Z');
  const updated = new Date('2026-01-05T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {},
        columns: {
          Backlog: ['task-1']
        }
      }),
      tasks: {
        'task-1.md': parseTask.json2md({
          name: 'Task 1',
          description: '',
          metadata: {
            created,
            updated
          },
          subTasks: [],
          relations: []
        })
      }
    }
  });

  const result = await kanbn.history(null, [new Date('2026-01-02T00:00:00.000Z'), new Date('2026-01-06T00:00:00.000Z')], null, null);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventType, 'updated');
});
