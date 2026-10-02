const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mockFileSystem = require('../real-fs');
const kanbn = require('../../src/main');
const parseIndex = require('../../src/parse-index');
const { complete, parseBoard } = require('../../src/complete');

const REPO = path.join(__dirname, '..', '..');
const BIN = path.join(REPO, 'bin', 'kanbn');
const EXAMPLES = path.join(REPO, 'example');

/**
 * Get the candidate values for a partial command line in a workspace
 * @param {string} cwd The workspace root
 * @param {string[]} words The words after "kanbn", the last being the one under the cursor
 * @param {object} [env={}] The environment
 * @return {string[]}
 */
function values(cwd, words, env = {}) {
  return complete(['kanbn', ...words], { cwd, env }).map(([value]) => value);
}

/**
 * Run the real CLI's completion entry point
 * @param {string} cwd The directory to run in
 * @param {string[]} words The words after "kanbn"
 * @return {object} The spawnSync result
 */
function run(cwd, words) {
  return spawnSync(process.execPath, [BIN, '__complete', '--', 'kanbn', ...words], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, KANBN_BOARD: '' }
  });
}

/**
 * Get the fastest of several runs of a command, in milliseconds
 * @param {string[]} args The arguments to node
 * @param {string} cwd The directory to run in
 * @return {number}
 */
function fastest(args, cwd) {
  let best = Infinity;
  for (let i = 0; i < 7; i++) {
    const start = process.hrtime.bigint();
    spawnSync(process.execPath, args, { cwd });
    best = Math.min(best, Number(process.hrtime.bigint() - start) / 1e6);
  }
  return best;
}

/**
 * Find every board file in the example workspaces
 * @return {string[]}
 */
function exampleBoards() {
  return fs.readdirSync(EXAMPLES)
    .map(name => path.join(EXAMPLES, name, '.kanbn'))
    .filter(folder => fs.existsSync(folder))
    .flatMap(folder => fs.readdirSync(folder).filter(name => name.endsWith('.md')).map(name => path.join(folder, name)));
}

/**
 * Check that the completion parser agrees with parse-index about a board's columns, task ids and
 * simple tasks. This is what makes it safe for src/complete.js to have its own parser
 * @param {object} assert
 * @param {string} markdown
 * @param {string} label
 */
function assertParsersAgree(assert, markdown, label) {
  const index = parseIndex.md2json(markdown);
  const fast = parseBoard(markdown);
  assert.deepEqual(
    Object.fromEntries(fast.columns.map(column => [column.name, column.tasks])),
    index.columns,
    `${label}: columns and task ids`
  );
  assert.deepEqual(
    Object.fromEntries(fast.columns.map(column => [column.name, column.simpleTasks])),
    Object.fromEntries(Object.keys(index.columns).map(name => [
      name,
      ((index.columnContent || {})[name] || [])
        .filter(entry => !entry.block && entry.text && entry.text.indexOf('\n') === -1)
        .map(entry => entry.text)
    ])),
    `${label}: simple tasks`
  );
}

const EDGE_CASES = [
  '# Name\n\nDesc\n\n```\n## Not a column\n- [nope](x)\n```\n\n## Todo\n\n- [a](tasks/a.md)\n' +
  '* [b](tasks/b.md) trailing text\n+ Plus item\n1. Numbered\n- [ ] Checkbox item\n- [x] Done checkbox\n' +
  '- **Bold** item\n- Multi\n  line\n- Lazy\ncontinuation\n\n  - [nested](tasks/nested.md)\n- After nested\n\n' +
  'A paragraph\n\n### Sub\n\n- [under-sub](tasks/u.md)\n\n## Options\n\n```yaml\nfoo: 1\n```\n\n' +
  '## Done\r\n\r\n- [c](tasks/c.md)\r\n\n## Todo\n\n- [d](tasks/d.md)\n',
  '---\nhiddenColumns:\n  - Done\n---\n\n## Name at level two\n\n## Todo\n\n- [a](tasks/a.md)\n\n## Name at level two\n\n- [b](tasks/b.md)\n',
  '# Name\n\n~~~\n## Fenced\n```\n## Still fenced\n~~~\n\n## Real\n\n- [a](tasks/a.md)\n\n#Not a heading\n\n##  Two spaces\n\n- [b](tasks/b.md)\n',
  '# Name\n\n## Empty\n\n## Only simple\n\n- Buy milk\n- Walk the dog\n'
];

/**
 * Write a workspace to a temporary folder
 * @param {object} files The files to write, as for real-fs
 * @return {string} The workspace root
 */
function workspace(files) {
  mockFileSystem(files);
  return kanbn.ROOT;
}

const BOARD =
  '---\nhiddenColumns:\n  - Archive\nsprints:\n  - start: 2026-01-01T00:00:00.000Z\n    name: First Sprint\n' +
  '  - start: 2026-01-08T00:00:00.000Z\n    name: Second\n---\n\n# Main\n\n' +
  '## Archive\n\n- [old-task](tasks/old-task.md)\n\n## Todo\n\n- [build-invoices](tasks/build-invoices.md)\n' +
  '- [build-reports](tasks/build-reports.md)\n- Buy milk\n\n## In Progress\n\n- [fix-login](tasks/fix-login.md)\n';
const TASKS = {
  'build-invoices.md': '---\ntags:\n  - Billing\n  - Large\nassigned: Ana\n---\n\n# Build invoices\n',
  'build-reports.md': '---\ntags: [Reports, "Large"]\nassigned: \'Ben\'\n---\n\n# Build reports\n',
  'fix-login.md': '# Fix login\n',
  'old-task.md': '# Old task\n'
};

QUnit.module('complete parser cross-check');

QUnit.test('The completion parser should agree with parse-index on every example board', assert => {
  const boards = exampleBoards();
  assert.ok(boards.length >= 5, 'found the example boards');
  for (const file of boards) {
    assertParsersAgree(assert, fs.readFileSync(file, { encoding: 'utf-8' }), path.relative(EXAMPLES, file));
  }
});

QUnit.test('The completion parser should agree with parse-index on awkward boards', assert => {
  EDGE_CASES.forEach((markdown, i) => assertParsersAgree(assert, markdown, `edge case ${i + 1}`));
});

QUnit.module('complete tests', {
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('The first word should complete to canonical command names', assert => {
  const commands = values(EXAMPLES, ['']);
  assert.ok(commands.indexOf('move') !== -1);
  assert.ok(commands.indexOf('mv') === -1, 'aliases are not offered');
  assert.ok(commands.indexOf('__complete') === -1);
  assert.deepEqual(values(EXAMPLES, ['mo']), ['move']);
  assert.deepEqual(complete(['kanbn', 'mo'], { cwd: EXAMPLES, env: {} }), [['move', 'Move Task']]);
});

QUnit.test('An unknown command should complete nothing', assert => {
  assert.deepEqual(values(EXAMPLES, ['nonsense', '']), []);
});

QUnit.test('completion should complete shell names', assert => {
  assert.deepEqual(values(EXAMPLES, ['completion', '']), ['bash', 'fish', 'zsh']);
  assert.deepEqual(values(EXAMPLES, ['comp']), ['completion']);
});

QUnit.test('help should complete command names', assert => {
  assert.deepEqual(values(EXAMPLES, ['help', 'sta']), ['status']);
});

QUnit.test('A word starting with a dash should complete option names', assert => {
  const options = values(EXAMPLES, ['move', '--']);
  for (const option of ['--column', '--position', '--board', '--interactive', '--no-actions', '--no-add']) {
    assert.ok(options.indexOf(option) !== -1, option);
  }
  assert.ok(options.indexOf('--no-interactive') === -1, 'only true-by-default booleans get --no-');
  assert.deepEqual(values(EXAMPLES, ['move', '--col']), ['--column']);
});

QUnit.test('A task id should complete from the board, with the column as its description', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.deepEqual(
    complete(['kanbn', 'move', 'build'], { cwd: root, env: {} }),
    [['build-invoices', 'Todo'], ['build-reports', 'Todo']]
  );
  assert.deepEqual(values(root, ['task', '']), ['old-task', 'build-invoices', 'build-reports', 'fix-login']);
});

QUnit.test('Only the positions that take a task id should complete one', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.deepEqual(values(root, ['move', 'fix-login', '']), [], 'second positional');
  assert.deepEqual(values(root, ['move', '--column', 'Todo', 'fix']), ['fix-login'], 'option values are skipped');
  assert.deepEqual(values(root, ['move', '-c', 'Todo', 'fix']), ['fix-login'], 'alias values are skipped');
  assert.deepEqual(values(root, ['move', '--relative', 'fix']), ['fix-login'], 'booleans take no value');
  assert.deepEqual(values(root, ['board', '']), [], 'commands without a positional provider');
});

QUnit.test('edit should offer simple tasks as well, and nothing else should', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.ok(values(root, ['edit', '']).indexOf('Buy milk') !== -1);
  assert.ok(values(root, ['move', '']).indexOf('Buy milk') === -1);
  assert.ok(values(root, ['task', '']).indexOf('Buy milk') === -1);
});

QUnit.test('A task whose name has drifted from its file should complete to the id the index links to', assert => {
  const root = workspace({
    '.kanbn': {
      'index.md': '# Main\n\n## Todo\n\n- [old-id](tasks/old-id.md)\n',
      tasks: { 'old-id.md': '# Zebra renamed\n' }
    }
  });
  assert.deepEqual(values(root, ['task', '']), ['old-id']);
});

QUnit.test('An option value should complete from that option\'s provider', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.deepEqual(values(root, ['move', 'x', '--column', '']), ['Todo', 'In Progress', 'Archive']);
  assert.deepEqual(values(root, ['move', 'x', '-c', 'In']), ['In Progress']);
  assert.deepEqual(values(root, ['move', 'x', '--position', '']), [], 'options without a provider');
});

QUnit.test('An option value given with = should complete in every shell\'s word splitting', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });

  // zsh and fish
  assert.deepEqual(values(root, ['move', 'x', '--column=In']), ['--column=In Progress']);

  // bash, which splits at the = and replaces only the last word
  assert.deepEqual(values(root, ['move', 'x', '--column', '=', 'In']), ['In Progress']);
  assert.deepEqual(values(root, ['move', 'x', '--column', '=']), ['=Todo', '=In Progress', '=Archive']);
});

QUnit.test('Hidden columns should be offered last, and marked', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  const columns = complete(['kanbn', 'add', '--column', ''], { cwd: root, env: {} });
  assert.deepEqual(columns[columns.length - 1], ['Archive', 'hidden']);
  assert.deepEqual(columns[0], ['Todo', '2 tasks']);
});

QUnit.test('--board, KANBN_BOARD and defaultBoard should choose the board, in that order', assert => {
  const design = '# Design\n\n## Ideas\n\n- [sketch](tasks/sketch.md)\n';
  const other = '# Other\n\n## Ideas\n\n- [other-task](tasks/other-task.md)\n';
  const root = workspace({
    '.kanbn': {
      'index.md': '---\ndefaultBoard: other # a comment\n---\n\n# Main\n\n## Todo\n\n- [main-task](tasks/main-task.md)\n',
      'design.md': design,
      'other.md': other,
      tasks: {}
    }
  });
  assert.deepEqual(values(root, ['task', '']), ['other-task'], 'defaultBoard');
  assert.deepEqual(values(root, ['task', ''], { KANBN_BOARD: 'design' }), ['sketch'], 'KANBN_BOARD');
  assert.deepEqual(values(root, ['task', '--board', 'main', ''], { KANBN_BOARD: 'design' }), ['main-task'], '--board');
  assert.deepEqual(values(root, ['task', '-b', 'design', '']), ['sketch'], '-b');
  assert.deepEqual(values(root, ['task', '--board=design', '']), ['sketch'], '--board=');
  assert.deepEqual(values(root, ['task', '--board', 'missing', '']), [], 'a board that doesn\'t exist');
});

QUnit.test('defaultBoard in a config file should choose the board', assert => {
  const root = workspace({
    'kanbn.json': JSON.stringify({ defaultBoard: 'design' }),
    '.kanbn': {
      'index.md': '# Main\n\n## Todo\n\n- [main-task](tasks/main-task.md)\n',
      'design.md': '# Design\n\n## Ideas\n\n- [sketch](tasks/sketch.md)\n',
      tasks: {}
    }
  });
  assert.deepEqual(values(root, ['task', '']), ['sketch']);
});

QUnit.test('A custom main folder and index file should be honoured', assert => {
  const root = workspace({
    'kanbn.yml': 'mainFolder: board\nindexFile: home.md\n',
    board: {
      'home.md': '# Main\n\n## Todo\n\n- [main-task](tasks/main-task.md)\n',
      tasks: {}
    }
  });
  assert.deepEqual(values(root, ['task', '']), ['main-task']);
  assert.deepEqual(values(root, ['task', '--board', 'main', '']), ['main-task']);
  assert.deepEqual(values(root, ['boards', '--rename', '']), ['home']);
});

QUnit.test('Board slugs should complete, without excluded boards', assert => {
  const root = workspace({
    'kanbn.json': JSON.stringify({ boards: { exclude: ['notes.md'] } }),
    '.kanbn': {
      'index.md': '# Main\n\n## Todo\n',
      'design.md': '# Design\n\n## Ideas\n',
      'notes.md': '# Notes\n',
      tasks: {}
    }
  });
  assert.deepEqual(values(root, ['board', '--board', '']), ['design', 'index']);
});

QUnit.test('restore should complete archived task ids', assert => {
  const root = workspace({
    '.kanbn': {
      'index.md': '# Main\n\n## Todo\n',
      tasks: {},
      archive: { 'gone.md': '# Gone\n', 'also-gone.md': '# Also gone\n' }
    }
  });
  assert.deepEqual(values(root, ['restore', '']), ['also-gone', 'gone']);
});

QUnit.test('Tags should complete from every task file', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.deepEqual(values(root, ['edit', 'x', '--tag', '']), ['Billing', 'Large', 'Reports']);
});

QUnit.test('Assignees should complete from the contributors, or from tasks if there are none', assert => {
  let root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.deepEqual(values(root, ['find', '--assigned', '']), ['Ana', 'Ben', '@me']);
  mockFileSystem.restore();

  root = workspace({
    'kanbn.yml': 'contributors:\n  - Cleo\n  - name: Dev\n    email: dev@example.com\n',
    '.kanbn': { 'index.md': BOARD, tasks: TASKS }
  });
  assert.deepEqual(values(root, ['find', '--assigned', '']), ['Cleo', 'Dev', '@me']);
});

QUnit.test('Sprints should complete by name', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  assert.deepEqual(
    complete(['kanbn', 'status', '--sprint', ''], { cwd: root, env: {} }),
    [['First Sprint', 'sprint 1'], ['Second', 'sprint 2']]
  );
});

QUnit.module('complete failure posture', {
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Outside a workspace there should be no candidates, no stderr, and exit 0', assert => {
  const root = workspace({});
  const result = run(root, ['move', '']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, ':4\n');
});

QUnit.test('A malformed index should produce no candidates, no stderr, and exit 0', assert => {
  const root = workspace({ '.kanbn': { 'index.md': '---\n: : [bad\n---\n\u0000garbage' } });
  for (const words of [['move', ''], ['move', 'x', '--column', ''], ['status', '--sprint', '']]) {
    const result = run(root, words);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, ':4\n');
  }
});

QUnit.test('Completion should print candidates and the directive', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  const result = run(root, ['move', 'fix']);
  assert.equal(result.stdout, 'fix-login\tIn Progress\n:4\n');
});

QUnit.test('Completion should not write anything', assert => {
  const root = workspace({ '.kanbn': { 'index.md': BOARD, tasks: TASKS } });
  const snapshot = () => {
    const files = {};
    const walk = folder => {
      for (const name of fs.readdirSync(folder)) {
        const file = path.join(folder, name);
        const stat = fs.statSync(file);
        files[file] = stat.isDirectory() ? (walk(file), 'dir') : stat.mtimeMs;
      }
    };
    walk(root);
    return files;
  };
  const before = snapshot();
  for (const words of [['move', ''], ['edit', 'x', '--tag', ''], ['add', '--column', ''], ['status', '--sprint', '']]) {
    run(root, words);
  }
  assert.deepEqual(snapshot(), before);
});

QUnit.test('Completion should not load the library', assert => {
  const result = spawnSync(process.execPath, [
    '-e',
    `process.argv = [process.argv[0], 'kanbn', '__complete', '--', 'kanbn', 'move', ''];` +
    `require(${JSON.stringify(REPO)})().then(() => {` +
    `  const loaded = Object.keys(require.cache).map(file => require('path').relative(${JSON.stringify(REPO)}, file));` +
    `  process.stderr.write(JSON.stringify(loaded.filter(file => !file.startsWith('node_modules'))));` +
    `});`
  ], { cwd: path.join(EXAMPLES, 'basic'), encoding: 'utf-8' });
  assert.deepEqual(JSON.parse(result.stderr).sort(), ['index.js', path.join('src', 'complete.js')]);
});

QUnit.test('Completion should stay well inside its latency budget', assert => {

  // Measured as overhead above Node's own startup, so that a slow machine doesn't fail it. Loading
  // the library costs ~50ms, so this catches the regression it exists for with plenty of room
  const cwd = path.join(EXAMPLES, 'basic');
  const floor = fastest(['-e', ''], cwd);
  const completion = fastest([BIN, '__complete', '--', 'kanbn', 'move', ''], cwd);
  assert.ok(completion - floor < 25, `${(completion - floor).toFixed(1)}ms over a ${floor.toFixed(1)}ms floor`);
});
