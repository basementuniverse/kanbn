const mockRequire = require('mock-require');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

QUnit.module('add interactive due date tests', {
  before() {
    mockRequire('../../src/main', mockKanbn);
    mockRequire('inquirer', {
      registerPrompt() {},
      async prompt() {
        return {
          name: 'Interactive task',
          setDescription: false,
          column: 'Test Column',
          setDue: true,
          due: new Date('2026-07-16T00:00:00.000Z'),
          setAssigned: false,
          subTasks: [],
          tags: [],
          relations: []
        };
      }
    });
  },
  beforeEach() {
    mockConfig.initialised = true;
    mockConfig.output = null;
    mockConfig.trackedTasks = [];
    mockConfig.index = {
      ...mockConfig.index,
      columns: {
        'Test Column': []
      }
    };
  }
});

QUnit.test('Interactive add stores due metadata as a Date', async assert => {
  const addController = require('../../src/controller/add');
  await addController({ interactive: true });

  // The controller uses a Promise chain for interactive mode, so flush the microtask queue.
  await Promise.resolve();

  assert.ok(mockConfig.output !== null, 'task was created');
  assert.ok(mockConfig.output.taskData.metadata.due instanceof Date, 'due metadata is a Date');
});
