const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const utility = require('../../src/utility');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('action controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.taskExists = true;
    mockConfig.output = null;
    mockConfig.taskColumn = 'Column 1';
    mockConfig.index = {
      name: 'Test Project',
      description: 'Test description',
      columns: {
        'Column 1': ['test-task-1'],
        'Column 2': []
      },
      options: {}
    };
  }
});

QUnit.test('--no-actions should turn actions off for the command', async assert => {
  // resolveBoard is where every board-aware command picks up its instance, so it's the one place
  // the flag has to be honoured. The mock hands back a single instance, so each case resets it
  mockKanbn.actionsEnabled = true;
  const withFlag = await utility.resolveBoard(mockKanbn, { actions: false });
  assert.equal(withFlag.actionsEnabled, false, '--no-actions should turn them off');

  mockKanbn.actionsEnabled = true;
  const withoutFlag = await utility.resolveBoard(mockKanbn, {});
  assert.equal(withoutFlag.actionsEnabled, true, 'without the flag they should stay on');
});

QUnit.test('a skipped rule should be reported on stderr', async assert => {
  mockConfig.lastActionWarnings = ['rule "assign-me" skipped "assign": @me couldn\'t be resolved'];
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2'], kanbn);
  });

  assert.contains(output, /assign-me/);
});

QUnit.test('a command with nothing skipped should print no action output', async assert => {
  mockConfig.lastActionWarnings = [];
  const output = await capture.stderr(async () => {
    await mockArgv(['move', 'test-task-1', '-c', 'Column 2'], kanbn);
  });

  assert.equal(output.join('').trim(), '');
});

QUnit.test('validate should report action rules that need a second look', async assert => {
  mockConfig.actionWarnings = [
    { type: 'conflicting-actions', message: 'rule "one" and rule "two" both write "assigned" on task.moved' }
  ];
  const output = await capture.stdout(async () => {
    await mockArgv(['validate'], kanbn);
  });

  assert.contains(output, /1 action rule needs a second look/);
  assert.contains(output, /both write "assigned"/);
});
