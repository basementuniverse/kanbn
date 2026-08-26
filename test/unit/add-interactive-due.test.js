const mockRequire = require('mock-require');
const capture = require('../capture');
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
    mockConfig.reset();
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

  // reRequire rather than require, so the controller picks up the mocked inquirer even if an
  // earlier test in the same run has already loaded it with the real one
  const addController = mockRequire.reRequire('../../src/controller/add');

  // The controller uses a Promise chain for interactive mode, so wait for it to report back rather
  // than letting its output land in the middle of the test output
  await capture.stdout(async () => {
    await addController({ interactive: true });
    await capture.waitFor(() => mockConfig.output !== null);
  });

  assert.ok(mockConfig.output !== null, 'task was created');
  assert.ok(mockConfig.output.taskData.metadata.due instanceof Date, 'due metadata is a Date');
});
