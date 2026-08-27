const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

function makeKanbn(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-boards-'));
  roots.push(root);
  for (const [name, contents] of Object.entries(files)) {
    const filePath = path.join(root, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
  return new Kanbn(root);
}

async function setup(files = {}, initialiseOptions = {}) {
  const kanbn = makeKanbn(files);
  await kanbn.initialise({
    name: 'Main Board',
    description: 'The main board',
    columns: ['Backlog', 'Todo', 'In Progress', 'Done'],
    ...initialiseOptions
  });
  return kanbn;
}

function boardFile(name, columns = ['Ideas'], options = null) {
  const frontMatter = options === null ? '' : `---\n${options}\n---\n\n`;
  return `${frontMatter}# ${name}\n\nA secondary board\n\n${columns.map(c => `## ${c}\n`).join('\n')}`;
}

QUnit.module('board tests', {
  before() {
    require('../qunit-throws-async');
  },
  after() {
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('board() should return an instance scoped to the requested board', async assert => {
  const kanbn = await setup();
  const mainFolder = await kanbn.getMainFolder();

  assert.equal(kanbn.boardSlug, null);
  assert.equal(await kanbn.getIndexPath(), path.join(mainFolder, 'index.md'));
  assert.equal(await kanbn.board('design').getIndexPath(), path.join(mainFolder, 'design.md'));
  assert.equal(await kanbn.board('design').board('ops').getIndexPath(), path.join(mainFolder, 'ops.md'));

  // The reserved aliases and an absent slug all resolve to the main board
  for (const slug of [null, '', 'main', 'default', 'index', 'MAIN']) {
    assert.equal(
      await kanbn.board(slug).getIndexPath(),
      path.join(mainFolder, 'index.md'),
      `"${slug}" should resolve to the main board`
    );
  }
});

QUnit.test('board() should share the config cache with its parent', async assert => {
  const kanbn = await setup({ 'kanbn.yml': 'dateFormat: "yyyy-mm-dd"\n' });
  const design = kanbn.board('design');

  await kanbn.getConfig();
  assert.deepEqual(await design.getConfig(), { dateFormat: 'yyyy-mm-dd' });

  // Clearing the cache on one instance clears it on the other, since they share it
  design.clearConfigCache();
  assert.equal(kanbn.configMemo, null);
});

QUnit.test('the main board slug should follow a customised indexFile', async assert => {
  const kanbn = await setup({ 'kanbn.yml': 'indexFile: board.md\n' });
  const mainFolder = await kanbn.getMainFolder();

  assert.equal(await kanbn.getMainBoardSlug(), 'board');
  assert.equal(await kanbn.getIndexPath(), path.join(mainFolder, 'board.md'));
  assert.equal(await kanbn.board('main').getIndexPath(), path.join(mainFolder, 'board.md'));
  assert.equal(await kanbn.board('board').getIndexPath(), path.join(mainFolder, 'board.md'));

  // "index" is no longer the main board here, so it's an ordinary slug
  assert.equal(await kanbn.board('index').getIndexPath(), path.join(mainFolder, 'index.md'));
});

QUnit.test('listBoards() should discover board files and ignore everything else', async assert => {
  const kanbn = await setup();
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(path.join(mainFolder, 'design.md'), boardFile('Design Pipeline'));
  fs.writeFileSync(path.join(mainFolder, 'ops.md'), boardFile('Ops & Infra'));

  // Not markdown, unparseable markdown, and files in the task and archive folders
  fs.writeFileSync(path.join(mainFolder, 'notes.txt'), 'just a note');
  fs.writeFileSync(path.join(mainFolder, 'broken.md'), 'no heading here');
  fs.mkdirSync(path.join(mainFolder, 'archive'), { recursive: true });
  fs.writeFileSync(path.join(mainFolder, 'archive', 'archived-task.md'), '# Archived Task\n');
  fs.writeFileSync(path.join(mainFolder, 'tasks', 'a-task.md'), '# A Task\n');

  const boards = await kanbn.listBoards();
  assert.deepEqual(boards.map(b => b.slug), ['index', 'design', 'ops'], 'main board first, then alphabetical');
  assert.deepEqual(boards.map(b => b.name), ['Main Board', 'Design Pipeline', 'Ops & Infra']);
  assert.deepEqual(boards.map(b => b.main), [true, false, false]);
  assert.equal(boards[1].path, path.join(mainFolder, 'design.md'));
  assert.equal(boards[1].description, 'A secondary board');
});

QUnit.test('listBoards() should honour boards.exclude and boards.order', async assert => {
  const kanbn = await setup({
    'kanbn.yml': 'boards:\n  exclude:\n    - notes.md\n  order:\n    - ops\n    - index\n'
  });
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(path.join(mainFolder, 'design.md'), boardFile('Design Pipeline'));
  fs.writeFileSync(path.join(mainFolder, 'ops.md'), boardFile('Ops & Infra'));
  fs.writeFileSync(path.join(mainFolder, 'notes.md'), '# Notes\n\nScratch file that happens to parse\n');

  const boards = await kanbn.listBoards();
  assert.deepEqual(boards.map(b => b.slug), ['ops', 'index', 'design'], 'ordered boards first, then the rest');
});

QUnit.test('createBoard() should reject reserved and malformed slugs', async assert => {
  const kanbn = await setup();

  for (const slug of ['index', 'main', 'default', 'tasks', 'archive']) {
    await assert.throwsAsync(
      async () => await kanbn.createBoard(slug),
      /is reserved/,
      `"${slug}" should be reserved`
    );
  }
  await assert.throwsAsync(async () => await kanbn.createBoard(''), /cannot be empty/);
  await assert.throwsAsync(async () => await kanbn.createBoard('Design Board'), /is not valid, try "design-board"/);
});

QUnit.test('createBoard() should write a self-describing board file', async assert => {
  const kanbn = await setup();
  const slug = await kanbn.createBoard('design', {
    name: 'Design Pipeline',
    description: 'Design work across the product',
    columns: ['Ideas', 'Designing', 'Signed Off'],
    options: { startedColumns: ['Designing'], completedColumns: ['Signed Off'] }
  });
  assert.equal(slug, 'design');
  assert.true(await kanbn.boardExists('design'));

  const board = await kanbn.board('design').getIndex();
  assert.equal(board.name, 'Design Pipeline');
  assert.equal(board.description, 'Design work across the product');
  assert.deepEqual(Object.keys(board.columns), ['Ideas', 'Designing', 'Signed Off']);
  assert.deepEqual(board.options.startedColumns, ['Designing']);

  await assert.throwsAsync(async () => await kanbn.createBoard('design'), /already exists/);
});

QUnit.test('renameBoard() and deleteBoard() should refuse to touch the main board', async assert => {
  const kanbn = await setup();
  await kanbn.createBoard('design', { name: 'Design Pipeline', columns: ['Ideas'] });

  await assert.throwsAsync(async () => await kanbn.deleteBoard('index'), /main board cannot be deleted/);
  await assert.throwsAsync(async () => await kanbn.renameBoard('main', 'other'), /main board cannot be renamed/);
  await assert.throwsAsync(async () => await kanbn.renameBoard('nope', 'other'), /doesn't exist/);

  assert.equal(await kanbn.renameBoard('design', 'ux', 'UX Pipeline'), 'ux');
  assert.false(await kanbn.boardExists('design'));
  assert.true(await kanbn.boardExists('ux'));
  assert.equal((await kanbn.board('ux').getIndex()).name, 'UX Pipeline');
});

QUnit.test('deleteBoard() should report tasks that would become untracked', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.createTask({ name: 'Design Only' }, 'Todo');
  await kanbn.createBoard('design', { name: 'Design', columns: ['Ideas'] });

  const design = kanbn.board('design');
  const board = await design.getIndex();
  board.columns.Ideas = ['shared-task', 'design-only'];
  await design.saveIndex(board);

  // shared-task is on the main board too, design-only is not - but the main board still has both,
  // so nothing is orphaned until we remove design-only from it
  const index = await kanbn.getIndex();
  index.columns.Todo = ['shared-task'];
  await kanbn.saveIndex(index);

  assert.deepEqual(await kanbn.findOrphanedTasks('design'), ['design-only']);
  assert.deepEqual(await kanbn.deleteBoard('design'), ['design-only']);
  assert.false(await kanbn.boardExists('design'));
});

QUnit.test('findTaskBoards() should report the column a task occupies on every board', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Shared Task' }, 'Todo');
  await kanbn.createBoard('design', { name: 'Design', columns: ['Ideas', 'Designing'] });

  const design = kanbn.board('design');
  const board = await design.getIndex();
  board.columns.Designing = ['shared-task'];
  await design.saveIndex(board);

  assert.deepEqual(await kanbn.findTaskBoards('shared-task'), { index: 'Todo', design: 'Designing' });
  assert.deepEqual(await kanbn.findTaskBoards('nonexistent-task'), {});
});

QUnit.test('board options should layer workspace config under the board front matter', async assert => {
  const kanbn = await setup({
    'kanbn.yml': [
      'dateFormat: "yyyy-mm-dd"',
      'startedColumns:',
      '  - In Progress',
      'completedColumns:',
      '  - Done',
      'boards:',
      '  design:',
      '    hiddenColumns:',
      '      - Ideas',
      '    completedColumns:',
      '      - Approved',
      ''
    ].join('\n')
  });
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(
    path.join(mainFolder, 'design.md'),
    boardFile('Design', ['Ideas', 'Designing', 'Signed Off'], 'completedColumns:\n  - Signed Off')
  );

  const design = await kanbn.board('design').getIndex();

  // Layer 1: workspace config
  assert.equal(design.options.dateFormat, 'yyyy-mm-dd');
  assert.deepEqual(design.options.startedColumns, ['In Progress']);

  // Layer 2: boards.<slug> in config beats the workspace
  assert.deepEqual(design.options.hiddenColumns, ['Ideas']);

  // Layer 3: board front matter beats both, and arrays override rather than merge
  assert.deepEqual(design.options.completedColumns, ['Signed Off']);
});

QUnit.test('board options should fall back to the main board front matter when there is no config file', async assert => {
  const kanbn = await setup({}, {
    options: {
      dateFormat: 'yyyy-mm-dd',
      sprints: [{ start: new Date('2026-01-01T00:00:00.000Z'), name: 'Sprint 1' }],
      startedColumns: ['In Progress'],
      completedColumns: ['Done'],
      hiddenColumns: ['Backlog']
    }
  });
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(
    path.join(mainFolder, 'design.md'),
    boardFile('Design', ['Ideas', 'Designing'], 'completedColumns:\n  - Designing')
  );

  const design = await kanbn.board('design').getIndex();

  // Workspace-scoped options are inherited, because with no config file the main board's front
  // matter is where they live
  assert.equal(design.options.dateFormat, 'yyyy-mm-dd', 'inherited from the main board front matter');
  assert.equal(design.options.sprints.length, 1, 'sprints are workspace-scoped, so they are inherited');

  // Board-scoped options are not: index.md's front matter is the main board's own file, and a
  // secondary board that happens to share a column name shouldn't silently pick up its behaviour
  assert.equal(design.options.startedColumns, undefined, 'board-scoped options stay with the main board');
  assert.equal(design.options.hiddenColumns, undefined, 'board-scoped options stay with the main board');
  assert.deepEqual(design.options.completedColumns, ['Designing'], 'the board declares its own');
});

QUnit.test('board-scoped options in a config file are inherited', async assert => {
  const kanbn = await setup({
    'kanbn.yml': 'startedColumns:\n  - In Progress\ncompletedColumns:\n  - Done\n'
  });
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(path.join(mainFolder, 'design.md'), boardFile('Design', ['Ideas', 'Designing']));

  // A config file is workspace-level by construction, so declaring a board-scoped option there is a
  // deliberate statement about every board
  const design = await kanbn.board('design').getIndex();
  assert.deepEqual(design.options.startedColumns, ['In Progress']);
  assert.deepEqual(design.options.completedColumns, ['Done']);
});

QUnit.test('workspace-scoped options in a secondary board front matter should be ignored', async assert => {
  const kanbn = await setup({ 'kanbn.yml': 'dateFormat: "yyyy-mm-dd"\ntaskFolder: tasks\n' });
  const mainFolder = await kanbn.getMainFolder();
  fs.writeFileSync(
    path.join(mainFolder, 'design.md'),
    boardFile('Design', ['Ideas'], 'dateFormat: "d mmm yy"\ntaskFolder: other-tasks\nhiddenColumns:\n  - Ideas')
  );

  const design = await kanbn.board('design').getIndex();
  assert.equal(design.options.dateFormat, 'yyyy-mm-dd', 'the board cannot override a workspace-scoped option');
  assert.equal(design.options.taskFolder, 'tasks');
  assert.deepEqual(design.options.hiddenColumns, ['Ideas'], 'board-scoped options still apply');
});

QUnit.test('saving a secondary board should not copy inherited options into its front matter', async assert => {
  const kanbn = await setup({}, {
    options: { dateFormat: 'yyyy-mm-dd', startedColumns: ['In Progress'], completedColumns: ['Done'] }
  });
  const mainFolder = await kanbn.getMainFolder();
  const designPath = path.join(mainFolder, 'design.md');
  fs.writeFileSync(designPath, boardFile('Design', ['Ideas', 'Designing'], 'completedColumns:\n  - Designing'));

  const design = kanbn.board('design');
  const board = await design.getIndex();
  await design.saveIndex(board);

  const savedOptions = require('../../src/parse-index').md2json(fs.readFileSync(designPath, 'utf-8')).options;
  assert.deepEqual(
    Object.keys(savedOptions).sort(),
    ['completedColumns'],
    'only the board\'s own options are written back'
  );
  assert.deepEqual(savedOptions.completedColumns, ['Designing']);

  // A changed option is written to the board file, not to the workspace
  board.options.hiddenColumns = ['Ideas'];
  await design.saveIndex(board);
  const updatedOptions = require('../../src/parse-index').md2json(fs.readFileSync(designPath, 'utf-8')).options;
  assert.deepEqual(updatedOptions.hiddenColumns, ['Ideas']);
  assert.deepEqual(
    (await kanbn.getIndex()).options.hiddenColumns,
    undefined,
    'the main board is untouched'
  );
});

QUnit.test('saving the main board should keep writing options where it always has', async assert => {
  const withConfig = await setup({ 'kanbn.yml': 'dateFormat: "yyyy-mm-dd"\n' });
  const index = await withConfig.getIndex();
  index.options.hiddenColumns = ['Backlog'];
  await withConfig.saveIndex(index);
  assert.true(
    fs.readFileSync(path.join(withConfig.ROOT, 'kanbn.yml'), 'utf-8').includes('hiddenColumns'),
    'options go to the config file when one exists'
  );

  const withoutConfig = await setup({}, { options: { startedColumns: ['In Progress'] } });
  const index2 = await withoutConfig.getIndex();
  index2.options.hiddenColumns = ['Backlog'];
  await withoutConfig.saveIndex(index2);
  const indexPath = await withoutConfig.getIndexPath();
  assert.true(
    fs.readFileSync(indexPath, 'utf-8').includes('hiddenColumns'),
    'options go to the front matter when there is no config file'
  );
});

QUnit.test('initialise() on a board-scoped instance should create that board', async assert => {
  const kanbn = await setup();
  const design = kanbn.board('design');

  await design.initialise({
    name: 'Design Pipeline',
    description: 'Design work',
    columns: ['Ideas', 'Designing', 'Signed Off']
  });
  assert.true(await kanbn.boardExists('design'));

  const board = await design.getIndex();
  assert.equal(board.name, 'Design Pipeline');
  assert.deepEqual(Object.keys(board.columns), ['Ideas', 'Designing', 'Signed Off']);

  // Re-initialising updates the board in place, in the same way it updates the main board
  await design.initialise({ name: 'UX Pipeline', columns: ['Ideas', 'Shipped'] });
  const updated = await design.getIndex();
  assert.equal(updated.name, 'UX Pipeline');
  assert.deepEqual(Object.keys(updated.columns), ['Ideas', 'Designing', 'Signed Off', 'Shipped']);
});

QUnit.test('a new board should not claim started or completed columns it does not have', async assert => {
  const kanbn = await setup();
  const parseIndex = require('../../src/parse-index');
  const mainFolder = await kanbn.getMainFolder();

  // A board with none of the default columns gets neither option
  await kanbn.board('design').initialise({ name: 'Design', columns: ['Ideas', 'Designing'] });
  const designOptions = parseIndex.md2json(
    fs.readFileSync(path.join(mainFolder, 'design.md'), 'utf-8')
  ).options;
  assert.deepEqual(designOptions, {}, 'no started or completed columns are invented');

  // ...and none are inherited from the main board either, even though it has both
  assert.equal((await kanbn.board('design').getIndex()).options.startedColumns, undefined);
  assert.equal((await kanbn.board('design').getIndex()).options.completedColumns, undefined);

  // A board that does have "Done" gets completedColumns, but not startedColumns
  await kanbn.board('ops').initialise({ name: 'Ops', columns: ['Backlog', 'Done'] });
  const opsOptions = parseIndex.md2json(
    fs.readFileSync(path.join(mainFolder, 'ops.md'), 'utf-8')
  ).options;
  assert.deepEqual(opsOptions, { completedColumns: ['Done'] });

  // Explicit options always win
  await kanbn.board('qa').initialise({
    name: 'QA',
    columns: ['Backlog', 'Done'],
    options: { completedColumns: ['Backlog'] }
  });
  const qaOptions = parseIndex.md2json(
    fs.readFileSync(path.join(mainFolder, 'qa.md'), 'utf-8')
  ).options;
  assert.deepEqual(qaOptions.completedColumns, ['Backlog']);
});

QUnit.test('untracked tasks should be workspace-scoped', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'On Both' }, 'Todo');
  await kanbn.createTask({ name: 'Design Only' }, 'Todo');
  await kanbn.createTask({ name: 'Nowhere' }, 'Todo');

  // Move design-only and nowhere off the main board
  const index = await kanbn.getIndex();
  index.columns.Todo = ['on-both'];
  await kanbn.saveIndex(index);

  await kanbn.board('design').initialise({ name: 'Design', columns: ['Ideas'] });
  const design = kanbn.board('design');
  const designBoard = await design.getIndex();
  designBoard.columns.Ideas = ['on-both', 'design-only'];
  await design.saveIndex(designBoard);

  // Only "nowhere" is on no board at all
  assert.deepEqual([...await kanbn.findWorkspaceUntrackedTasks()], ['nowhere']);

  // The board-scoped view still reports everything missing from that board
  assert.deepEqual([...await kanbn.findUntrackedTasks()].sort(), ['design-only', 'nowhere']);

  // ...and the tasks that other boards track but this one doesn't
  assert.deepEqual(await kanbn.findTasksOnOtherBoards(), { 'design-only': { design: 'Ideas' } });
  assert.deepEqual(await design.findTasksOnOtherBoards(), {});
});

QUnit.test('status should separate untracked tasks from tasks on other boards', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'On Both' }, 'Todo');
  await kanbn.createTask({ name: 'Design Only' }, 'Todo');
  await kanbn.createTask({ name: 'Nowhere' }, 'Todo');

  const index = await kanbn.getIndex();
  index.columns.Todo = ['on-both'];
  await kanbn.saveIndex(index);

  await kanbn.board('design').initialise({ name: 'Design', columns: ['Ideas'] });
  const design = kanbn.board('design');
  const designBoard = await design.getIndex();
  designBoard.columns.Ideas = ['on-both', 'design-only'];
  await design.saveIndex(designBoard);

  const status = await kanbn.status(false, true);
  assert.equal(status.board, 'index', 'status names the board it applied to once there are several');
  assert.deepEqual(status.untrackedTasks, ['nowhere.md']);
  assert.deepEqual(status.tasksOnOtherBoards, { 'design-only': { design: 'Ideas' } });

  const designStatus = await design.status(false, true);
  assert.equal(designStatus.board, 'design');
  assert.deepEqual(designStatus.untrackedTasks, ['nowhere.md']);
  assert.equal('tasksOnOtherBoards' in designStatus, false, 'design has every tracked task');
});

QUnit.test('status should be unchanged in a single-board workspace', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Tracked' }, 'Todo');

  const status = await kanbn.status(false, true);
  assert.equal('board' in status, false, 'no board field when there is only one board');
  assert.deepEqual(status.untrackedTasks, []);
  assert.equal('tasksOnOtherBoards' in status, false);
});
