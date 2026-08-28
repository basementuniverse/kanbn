const mockRequire = require('mock-require');

let renderedTable = null;
let board;

QUnit.module('board rendering tests', {

  // terminal-kit writes straight to the terminal, so the table is captured here rather than by
  // scraping stdout. The mock is installed only while this module runs, and the real module is put
  // back in the require cache afterwards so that nothing else sees it
  before() {
    mockRequire('terminal-kit', {
      terminal: {
        width: 80,
        table: table => {
          renderedTable = table;
        }
      }
    });
    board = mockRequire.reRequire('../../src/board');
  },
  after() {
    mockRequire.stop('terminal-kit');
    mockRequire.reRequire('../../src/board');
  },
  beforeEach() {
    renderedTable = null;
  }
});

function testIndex(columnContent = null) {
  const index = {
    name: 'Test Project',
    description: '',
    options: {},
    columns: {
      'Column 1': ['test-task-1'],
      'Column 2': []
    }
  };
  if (columnContent !== null) {
    index.columnContent = columnContent;
  }
  return index;
}

const TEST_TASKS = [
  {
    id: 'test-task-1',
    name: 'Test Task 1',
    description: '',
    metadata: {},
    subTasks: [],
    relations: [],
    comments: [],
    column: 'Column 1',
    workload: 2,
    progress: 0
  }
];

/**
 * The cells of the first (and only) lane
 */
function laneCells() {
  return renderedTable[2];
}

QUnit.test('Simple tasks should be shown dimmed in the default layout', async assert => {
  await board.show(
    testIndex({ 'Column 1': [{ position: 1, text: 'Buy milk', raw: '- Buy milk' }] }),
    TEST_TASKS
  );

  assert.ok(/Test Task 1/.test(laneCells()[0]), 'the real task is shown');
  assert.ok(/\^-Buy milk\^:/.test(laneCells()[0]), 'the simple task is shown dimmed');
});

QUnit.test('Simple tasks should be shown in a column with no tasks', async assert => {
  await board.show(
    testIndex({ 'Column 2': [{ position: 0, text: 'Buy milk', raw: '- Buy milk' }] }),
    TEST_TASKS
  );

  assert.ok(/Buy milk/.test(laneCells()[1]));
});

QUnit.test('Simple tasks should be left out of a named view', async assert => {
  const index = testIndex({ 'Column 1': [{ position: 1, text: 'Buy milk', raw: '- Buy milk' }] });
  index.options.views = [
    {
      name: 'Test view',
      columns: [{ name: 'Column 1', filters: { column: 'Column 1' } }]
    }
  ];

  await board.show(index, TEST_TASKS, 'Test view');

  assert.notOk(/Buy milk/.test(laneCells().join('')));
});

QUnit.test('A block of prose should not be shown on the board', async assert => {
  await board.show(
    testIndex({ 'Column 1': [{ position: 1, text: 'Some prose', raw: 'Some prose', block: true }] }),
    TEST_TASKS
  );

  assert.notOk(/Some prose/.test(laneCells().join('')));
});

QUnit.test('Markup characters in a simple task should be escaped', async assert => {
  await board.show(
    testIndex({ 'Column 1': [{ position: 1, text: 'Fix the ^ character', raw: '- Fix the ^ character' }] }),
    TEST_TASKS
  );

  assert.ok(/Fix the \^\^ character/.test(laneCells()[0]), 'a caret is escaped for terminal-kit');
});

QUnit.test('A board with no simple tasks should render as it always has', async assert => {
  await board.show(testIndex(), TEST_TASKS);

  assert.ok(/Test Task 1/.test(laneCells()[0]));
  assert.equal(laneCells()[1], '');
});
