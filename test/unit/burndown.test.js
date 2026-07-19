const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const parseIndex = require('../../src/parse-index');
const parseTask = require('../../src/parse-task');

function findDataPoint(series, date) {
  return series.dataPoints.find((dataPoint) => dataPoint.x.toISOString() === date.toISOString());
}

QUnit.module('burndown tests', {
  before() {
    require('../qunit-throws-async');
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Burndown should use history events to track reopened work', async assert => {
  const created = new Date('2026-01-01T00:00:00.000Z');
  const started = new Date('2026-01-02T00:00:00.000Z');
  const completed = new Date('2026-01-03T00:00:00.000Z');
  const reopened = new Date('2026-01-04T00:00:00.000Z');
  const end = new Date('2026-01-05T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {
          startedColumns: ['In Progress'],
          completedColumns: ['Done']
        },
        columns: {
          Backlog: [],
          'In Progress': ['task-1'],
          Done: []
        }
      }),
      tasks: {
        'task-1.md': parseTask.json2md({
          name: 'Task 1',
          description: '',
          metadata: {
            tags: ['Small']
          },
          subTasks: [],
          relations: [],
          history: [
            {
              type: 'created',
              date: created,
              column: 'Backlog'
            },
            {
              type: 'moved',
              date: started,
              fromColumn: 'Backlog',
              toColumn: 'In Progress'
            },
            {
              type: 'moved',
              date: completed,
              fromColumn: 'In Progress',
              toColumn: 'Done'
            },
            {
              type: 'moved',
              date: reopened,
              fromColumn: 'Done',
              toColumn: 'In Progress'
            }
          ]
        })
      }
    }
  });

  const result = await kanbn.burndown(null, [created, end], null, null, 'seconds');
  const series = result.series[0];

  assert.equal(findDataPoint(series, created).y, 0, 'task is not active when created in backlog');
  assert.equal(findDataPoint(series, started).y, 2, 'task becomes active when moved to started column');
  assert.equal(findDataPoint(series, completed).y, 0, 'task is inactive when moved to completed column');
  assert.equal(findDataPoint(series, reopened).y, 2, 'task becomes active again when reopened');

  const reopenEvents = findDataPoint(series, reopened).tasks;
  assert.equal(reopenEvents[0].eventType, 'moved');
});

QUnit.test('Burndown should fallback to legacy metadata dates when history is absent', async assert => {
  const created = new Date('2026-01-01T00:00:00.000Z');
  const started = new Date('2026-01-02T00:00:00.000Z');
  const completed = new Date('2026-01-03T00:00:00.000Z');
  const end = new Date('2026-01-04T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {
          startedColumns: ['In Progress'],
          completedColumns: ['Done']
        },
        columns: {
          Backlog: [],
          'In Progress': [],
          Done: ['task-1']
        }
      }),
      tasks: {
        'task-1.md': parseTask.json2md({
          name: 'Task 1',
          description: '',
          metadata: {
            created,
            started,
            completed,
            tags: ['Small']
          },
          subTasks: [],
          relations: []
        })
      }
    }
  });

  const result = await kanbn.burndown(null, [created, end], null, null, 'seconds');
  const series = result.series[0];

  assert.equal(findDataPoint(series, created).y, 0);
  assert.equal(findDataPoint(series, started).y, 2);
  assert.equal(findDataPoint(series, completed).y, 0);
});

QUnit.test('Burndown should reduce remaining workload when progress events occur', async assert => {
  const created = new Date('2026-02-01T00:00:00.000Z');
  const started = new Date('2026-02-02T00:00:00.000Z');
  const progress = new Date('2026-02-03T00:00:00.000Z');
  const end = new Date('2026-02-04T00:00:00.000Z');

  mockFileSystem({
    '.kanbn': {
      'index.md': parseIndex.json2md({
        name: 'test',
        description: '',
        options: {
          startedColumns: ['In Progress'],
          completedColumns: ['Done']
        },
        columns: {
          Backlog: [],
          'In Progress': ['task-1'],
          Done: []
        }
      }),
      tasks: {
        'task-1.md': parseTask.json2md({
          name: 'Task 1',
          description: '',
          metadata: {
            tags: ['Small']
          },
          subTasks: [],
          relations: [],
          history: [
            {
              type: 'created',
              date: created,
              column: 'Backlog'
            },
            {
              type: 'moved',
              date: started,
              fromColumn: 'Backlog',
              toColumn: 'In Progress'
            },
            {
              type: 'progress',
              date: progress,
              fromProgress: 0,
              toProgress: 0.5
            }
          ]
        })
      }
    }
  });

  const result = await kanbn.burndown(null, [created, end], null, null, 'seconds');
  const series = result.series[0];

  assert.equal(findDataPoint(series, started).y, 2, 'full workload before progress update');
  assert.equal(findDataPoint(series, progress).y, 1, 'remaining workload reflects 50% progress');
  assert.equal(findDataPoint(series, progress).tasks[0].eventType, 'progress');
});
