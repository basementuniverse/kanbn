const mockFileSystem = require('../real-fs');
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

QUnit.test('Burndown should treat reopened work as active', async assert => {
  const created = new Date('2026-01-01T00:00:00.000Z');
  const started = new Date('2026-01-02T00:00:00.000Z');
  const completed = new Date('2026-01-03T00:00:00.000Z');
  const reopened = new Date('2026-01-04T00:00:00.000Z');
  const end = new Date('2026-01-05T00:00:00.000Z');

  // A task that was completed and then reopened: the completed date has been cleared (kanbn edit
  // --unset completed), so only the started date remains. The history still records the moves in
  // and out of Done, but burndown works from the dates rather than from those columns
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
            tags: ['Small'],
            created,
            started
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

  assert.equal(findDataPoint(series, created).y, 0, 'task is not active before its started date');
  assert.equal(findDataPoint(series, started).y, 2, 'task becomes active on its started date');

  // The task passed through Done between these two dates, but it has no completed date, so the work
  // is still outstanding and stays counted
  assert.equal(findDataPoint(series, completed).y, 2, 'work with no completed date stays outstanding');
  assert.equal(findDataPoint(series, reopened).y, 2, 'reopened work is still counted');

  const reopenEvents = findDataPoint(series, reopened).tasks;
  assert.equal(reopenEvents[0].eventType, 'moved', 'history events still annotate the chart');
});

QUnit.test('Burndown should ignore columns when a task has no dates', async assert => {
  const created = new Date('2026-03-01T00:00:00.000Z');
  const end = new Date('2026-03-05T00:00:00.000Z');

  // The task sits in a started column but has never been given a started date, so there is nothing
  // to say when the work began. It used to be counted as active from its created date
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
            tags: ['Small'],
            created
          },
          subTasks: [],
          relations: []
        })
      }
    }
  });

  const result = await kanbn.burndown(null, [created, end], null, null, 'seconds');
  const series = result.series[0];

  assert.equal(findDataPoint(series, created).y, 0, 'a task with no started date is never active');
  assert.equal(findDataPoint(series, end).y, 0, 'the column it sits in does not make it active');
});

QUnit.test('Burndown should derive activity from metadata dates', async assert => {
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
            tags: ['Small'],
            created,
            started
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
