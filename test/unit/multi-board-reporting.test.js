const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-report-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Main Board',
    options: { startedColumns: ['In Progress'], completedColumns: ['Done'] },
    columns: ['Backlog', 'Todo', 'In Progress', 'Done']
  });
  await kanbn.board('design').initialise({ name: 'Design', columns: ['Ideas', 'Designing', 'Signed Off'] });
  return kanbn;
}

function writeFrontMatter(mainFolder, slug, frontMatter) {
  const file = path.join(mainFolder, `${slug}.md`);
  fs.writeFileSync(file, `---\n${frontMatter}\n---\n\n${fs.readFileSync(file, 'utf-8').replace(/^---[\s\S]*?---\n\n/, '')}`);
}

QUnit.module('multi-board reporting tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('history should show only this board\'s events plus the board-agnostic ones', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  const design = kanbn.board('design');
  await design.addTaskToBoard('shared-task', 'Ideas');
  await design.moveTask('shared-task', 'Designing');
  await kanbn.moveTask('shared-task', 'In Progress');
  const taskData = await kanbn.getTask('shared-task');
  await kanbn.updateTask('shared-task', { ...taskData, metadata: { ...taskData.metadata, progress: 0.5 } });

  const historyTypes = result => result.events.filter(e => e.source === 'history').map(e => e.eventType);

  // Progress is a property of the task, not a board, so it shows up on both
  assert.deepEqual(historyTypes(await kanbn.history()), ['created', 'moved', 'progress']);
  assert.deepEqual(historyTypes(await design.history()), ['added', 'moved', 'progress']);
});

QUnit.test('burndown datapoints should not be placed by another board\'s events', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  const design = kanbn.board('design');
  await design.addTaskToBoard('shared-task', 'Ideas');
  await design.moveTask('shared-task', 'Designing');

  // The design move happened after the task was created, and is the only event that isn't the main
  // board's - so the main board's series must not gain a datapoint for it
  const mainSeries = (await kanbn.burndown()).series[0];
  const designEventDate = (await kanbn.getTask('shared-task')).history
    .find(event => event.board === 'design' && event.type === 'moved').date;
  assert.false(
    mainSeries.dataPoints.some(point => point.x.getTime() === designEventDate.getTime()),
    'the design board\'s move is not a datapoint on the main board'
  );
});

QUnit.test('burndown should say what is missing when a board has no started columns', async assert => {
  const kanbn = await setup();
  await assert.throwsAsync(
    async () => await kanbn.board('design').burndown(),
    /Board "design" declares no startedColumns, so it has no notion of work in progress/
  );
});

QUnit.test('a board declaring its own sprints should override the workspace list', async assert => {
  const kanbn = await setup();
  await kanbn.sprint('Foundation', '', new Date('2026-01-01T00:00:00.000Z'));

  const mainFolder = await kanbn.getMainFolder();
  writeFrontMatter(mainFolder, 'design', 'sprints:\n  - start: 2026-02-01T00:00:00.000Z\n    name: Design Kickoff');

  assert.deepEqual((await kanbn.getIndex()).options.sprints.map(s => s.name), ['Foundation']);
  assert.deepEqual(
    (await kanbn.board('design').getIndex()).options.sprints.map(s => s.name),
    ['Design Kickoff'],
    'arrays override rather than merge'
  );
});

QUnit.test('sprint on a board with no list of its own should append to the workspace list', async assert => {
  const kanbn = await setup();
  const sprint = await kanbn.board('design').sprint('', '', new Date('2026-01-01T00:00:00.000Z'));

  assert.equal(sprint.name, 'Sprint 1', 'the workspace list numbers it, with no board prefix');
  assert.equal(sprint.board, null, 'the caller is told it went to the workspace list');
  assert.deepEqual((await kanbn.getIndex()).options.sprints.map(s => s.name), ['Sprint 1']);
  assert.equal(
    'sprints' in (await kanbn.board('design').getIndex()).ownOptions,
    false,
    'the board is not silently forked onto its own list'
  );
});

QUnit.test('sprint on a board with its own list should append there, with a board-prefixed name', async assert => {
  const kanbn = await setup();
  const mainFolder = await kanbn.getMainFolder();
  writeFrontMatter(mainFolder, 'design', 'sprints:\n  - start: 2026-02-01T00:00:00.000Z\n    name: Design Kickoff');

  const sprint = await kanbn.board('design').sprint('', '', new Date('2026-03-01T00:00:00.000Z'));
  assert.equal(sprint.name, 'Design Sprint 2', 'board-local auto-names cannot collide across boards');
  assert.equal(sprint.board, 'design');
  assert.deepEqual(
    (await kanbn.board('design').getIndex()).options.sprints.map(s => s.name),
    ['Design Kickoff', 'Design Sprint 2']
  );
  assert.equal('sprints' in (await kanbn.getIndex()).options, false, 'the workspace list is untouched');
});

QUnit.test('searchAllBoards should annotate results with every board and column', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.createTask({ name: 'Main Only' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Designing');

  const results = await kanbn.searchAllBoards({ name: 'Shared' });
  assert.equal(results.length, 1, 'a task on several boards appears once');
  assert.deepEqual(results[0].boards, { index: 'Todo', design: 'Designing' });

  assert.deepEqual(
    (await kanbn.searchAllBoards({}, true)).sort(),
    ['main-only', 'shared-task']
  );
});

QUnit.test('validateAllBoards should validate every board', async assert => {
  const kanbn = await setup();
  const mainFolder = await kanbn.getMainFolder();
  await kanbn.createTask({ name: 'Broken Task' }, 'Todo');
  fs.writeFileSync(path.join(mainFolder, 'tasks', 'broken-task.md'), 'no heading');

  assert.equal(await kanbn.board('design').validate(), true, 'design references nothing broken');
  const result = await kanbn.validateAllBoards();
  assert.equal(result.length, 1);
  assert.equal(result[0].board, 'index');
  assert.equal(result[0].task, 'broken-task');
});

QUnit.test('findBoardWarnings should report multi-board problems', async assert => {
  const kanbn = await setup();
  const mainFolder = await kanbn.getMainFolder();

  // A workspace-scoped option and a completed column on a secondary board, plus out-of-order sprints
  writeFrontMatter(
    mainFolder,
    'design',
    [
      "dateFormat: 'yyyy-mm-dd'",
      'completedColumns:',
      '  - Signed Off',
      'sprints:',
      '  - start: 2026-02-01T00:00:00.000Z',
      '    name: Second',
      '  - start: 2026-01-01T00:00:00.000Z',
      '    name: First'
    ].join('\n')
  );

  // A markdown file that isn't a board, and a task on no board
  fs.writeFileSync(path.join(mainFolder, 'broken.md'), 'no heading here');
  fs.writeFileSync(path.join(mainFolder, 'tasks', 'loose-task.md'), '# Loose Task\n');

  const warnings = await kanbn.findBoardWarnings();
  const byType = Object.fromEntries(warnings.map(w => [w.type, w]));

  assert.equal(byType['workspace-scoped-option'].board, 'design');
  assert.true(byType['workspace-scoped-option'].message.includes('dateFormat'));
  assert.equal(byType['sprints-out-of-order'].board, 'design');
  assert.equal(byType['unparseable-board'].board, 'broken');
  assert.equal(byType['untracked-task'].message, 'task "loose-task" isn\'t on any board');
  assert.true(byType['multiple-stamping-authorities'].message.includes('"completed"'));
});

QUnit.test('findBoardWarnings should report history naming a board that has gone', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.board('design').addTaskToBoard('shared-task', 'Ideas');
  await kanbn.deleteBoard('design');

  const warnings = await kanbn.findBoardWarnings();
  const unknownBoard = warnings.find(w => w.type === 'unknown-board-in-history');
  assert.equal(unknownBoard.board, 'design');
  assert.true(unknownBoard.message.includes('doesn\'t exist'));
});

QUnit.test('findBoardWarnings should report a task in two columns on one board', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');

  const index = await kanbn.getIndex();
  index.columns.Backlog = ['shared-task'];
  await kanbn.saveIndex(index);

  const warnings = await kanbn.findBoardWarnings();
  const duplicate = warnings.find(w => w.type === 'duplicate-task');
  assert.equal(duplicate.board, 'index');
  assert.true(duplicate.message.includes('shared-task'));
});

QUnit.test('findBoardWarnings should report a board reference with no task file', async assert => {
  const kanbn = await setup();
  const index = await kanbn.getIndex();
  index.columns.Todo = ['ghost-task'];
  await kanbn.saveIndex(index);

  const warnings = await kanbn.findBoardWarnings();
  const missing = warnings.find(w => w.type === 'missing-task-file');
  assert.true(missing.message.includes('ghost-task'));
});

QUnit.test('a single-board workspace should produce no board warnings', async assert => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-report-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({ name: 'Solo', columns: ['Todo', 'Done'] });
  await kanbn.createTask({ name: 'Only Task' }, 'Todo');

  assert.deepEqual(await kanbn.findBoardWarnings(), []);
});

QUnit.test('the multi-board example workspace should be valid', async assert => {
  // The example is documentation, so it needs to stay correct as the code moves
  const example = new Kanbn(path.join(__dirname, '..', '..', 'example', 'boards'));

  assert.deepEqual(
    (await example.listBoards()).map(board => board.slug),
    ['index', 'design']
  );
  assert.equal(await example.validateAllBoards(), true, 'every board and task parses');
  assert.deepEqual(await example.findBoardWarnings(), [], 'no multi-board warnings');
  assert.deepEqual(await example.findDateDrift(), [], 'no drift on the main board');
  assert.deepEqual(await example.board('design').findDateDrift(), [], 'no drift on the design board');

  // The point of the example: the same task in a different column on each board
  assert.deepEqual(await example.findTaskBoards('build-tenant-settings-page'), {
    index: 'In Progress',
    design: 'Designing'
  });

  // ...and per-board state fields keeping design's progress out of engineering's
  const switcher = await example.getTask('create-organization-switcher');
  assert.true('designSignedOffAt' in switcher.metadata, 'design has signed it off');
  assert.false('completed' in switcher.metadata, 'engineering has not finished it');

  // Each board counts the task as complete only against its own completedField, so design signing
  // off doesn't mark it done for engineering
  const summary = Object.fromEntries((await example.getBoardsSummary()).map(board => [board.slug, board]));
  assert.equal(summary.design.completed, 1, 'the design board counts its own signed-off task');
  assert.equal(
    summary.index.completed,
    1,
    'the engineering board counts only the task with a shared completed date'
  );
});
