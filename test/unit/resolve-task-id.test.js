const mockFileSystem = require('../real-fs');
const kanbn = require('../../src/main');

const TASK_IDS = [
  'build-invoice-download-endpoint',
  'build-tenant-settings-page',
  'create-organization-switcher',
  'refactor-auth-middleware'
];

function workspace(options = '', extraTasks = {}) {
  mockFileSystem({
    '.kanbn': {
      'index.md':
        (options ? `---\n${options}\n---\n\n` : '') +
        '# Test Project\n\n## Todo\n\n' +
        TASK_IDS.slice(0, 2).map(id => `- [${id}](tasks/${id}.md)`).join('\n') +
        '\n\n## Done\n\n' +
        TASK_IDS.slice(2).map(id => `- [${id}](tasks/${id}.md)`).join('\n') +
        '\n',
      'tasks': {
        ...Object.fromEntries(TASK_IDS.map(id => [`${id}.md`, `# ${id}`])),
        ...extraTasks
      }
    }
  });
}

QUnit.module('resolveTaskId tests', {
  before() {
    require('../qunit-throws-async');
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Resolve in uninitialised folder should throw "not initialised" error', async assert => {
  mockFileSystem();
  await assert.throwsAsync(
    async () => {
      await kanbn.resolveTaskId('build');
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Exact id resolves to itself', async assert => {
  workspace();
  assert.deepEqual(
    await kanbn.resolveTaskId('build-tenant-settings-page'),
    { id: 'build-tenant-settings-page', match: 'exact' }
  );
});

QUnit.test('Exact id wins even when it is also a prefix of another id', async assert => {
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Todo\n\n- [build](tasks/build.md)\n- [build-page](tasks/build-page.md)\n',
      'tasks': {
        'build.md': '# build',
        'build-page.md': '# build-page'
      }
    }
  });
  assert.deepEqual(await kanbn.resolveTaskId('build'), { id: 'build', match: 'exact' });
});

QUnit.test('Untracked task file resolves to itself rather than to a looser match', async assert => {
  workspace('', { 'refactor.md': '# refactor' });
  assert.deepEqual(await kanbn.resolveTaskId('refactor'), { id: 'refactor', match: 'file' });
});

QUnit.test('Unique prefix resolves', async assert => {
  workspace();
  assert.deepEqual(
    await kanbn.resolveTaskId('build-inv'),
    { id: 'build-invoice-download-endpoint', match: 'prefix' }
  );
});

QUnit.test('Prefix match is case-insensitive', async assert => {
  workspace();
  assert.deepEqual(
    await kanbn.resolveTaskId('Refactor'),
    { id: 'refactor-auth-middleware', match: 'prefix' }
  );
});

QUnit.test('Unique substring resolves', async assert => {
  workspace();
  assert.deepEqual(
    await kanbn.resolveTaskId('invoice'),
    { id: 'build-invoice-download-endpoint', match: 'substring' }
  );
});

QUnit.test('Ambiguous prefix throws listing the candidates', async assert => {
  workspace();
  try {
    await kanbn.resolveTaskId('build');
    assert.ok(false, 'should have thrown');
  } catch (error) {
    assert.ok(/Task id "build" is ambiguous/.test(error.message));
    assert.ok(error.message.includes('  build-invoice-download-endpoint'));
    assert.ok(error.message.includes('  build-tenant-settings-page'));
    assert.deepEqual(error.candidates, ['build-invoice-download-endpoint', 'build-tenant-settings-page']);
  }
});

QUnit.test('Ambiguous substring throws rather than guessing', async assert => {
  workspace();
  await assert.throwsAsync(
    async () => {
      await kanbn.resolveTaskId('uild');
    },
    /Task id "uild" is ambiguous/
  );
});

QUnit.test('Inputs shorter than four characters are only matched exactly', async assert => {
  workspace('taskIdResolution: fuzzy');
  assert.deepEqual(await kanbn.resolveTaskId('ref'), { id: 'ref', match: null });
  assert.deepEqual(
    await kanbn.resolveTaskId('refa'),
    { id: 'refactor-auth-middleware', match: 'prefix' }
  );
});

QUnit.test('Ambiguous error lists at most 10 candidates', async assert => {
  const ids = Array.from({ length: 13 }, (_, i) => `task-${i}`);
  mockFileSystem({
    '.kanbn': {
      'index.md': '# Test Project\n\n## Todo\n\n' + ids.map(id => `- [${id}](tasks/${id}.md)`).join('\n') + '\n',
      'tasks': Object.fromEntries(ids.map(id => [`${id}.md`, `# ${id}`]))
    }
  });
  try {
    await kanbn.resolveTaskId('task');
    assert.ok(false, 'should have thrown');
  } catch (error) {
    assert.equal(error.message.split('\n').filter(line => /^  task-/.test(line)).length, 10);
    assert.ok(error.message.endsWith('...and 3 more'));
    assert.equal(error.candidates.length, 13);
  }
});

QUnit.test('No match returns the input unchanged', async assert => {
  workspace();
  assert.deepEqual(await kanbn.resolveTaskId('nothing-like-it'), { id: 'nothing-like-it', match: null });
});

QUnit.test('Empty input returns unchanged', async assert => {
  workspace();
  assert.deepEqual(await kanbn.resolveTaskId(''), { id: '', match: null });
});

QUnit.test('Fuzzy matching is off by default', async assert => {
  workspace();
  assert.deepEqual(await kanbn.resolveTaskId('bldinv'), { id: 'bldinv', match: null });
});

QUnit.test('Fuzzy matching resolves when enabled', async assert => {
  workspace('taskIdResolution: fuzzy');
  assert.deepEqual(
    await kanbn.resolveTaskId('bldinv'),
    { id: 'build-invoice-download-endpoint', match: 'fuzzy' }
  );
});

QUnit.test('Prefix still wins over fuzzy when fuzzy is enabled', async assert => {
  workspace('taskIdResolution: fuzzy');
  assert.deepEqual(
    await kanbn.resolveTaskId('create'),
    { id: 'create-organization-switcher', match: 'prefix' }
  );
});

QUnit.test('Exact mode disables prefix and substring matching', async assert => {
  workspace('taskIdResolution: exact');
  assert.deepEqual(await kanbn.resolveTaskId('build-inv'), { id: 'build-inv', match: null });
});

QUnit.test('Unknown mode in the config file falls back to the default', async assert => {
  workspace();
  require('fs').writeFileSync(require('path').join(kanbn.ROOT, 'kanbn.yml'), 'taskIdResolution: sideways\n');
  assert.deepEqual(
    await kanbn.resolveTaskId('build-inv'),
    { id: 'build-invoice-download-endpoint', match: 'prefix' }
  );
});

QUnit.test('Only tasks on the target board are candidates', async assert => {
  workspace('', { 'design-task.md': '# design-task' });
  require('fs').writeFileSync(
    require('path').join(kanbn.ROOT, '.kanbn', 'design.md'),
    '# Design\n\n## Todo\n\n- [design-task](tasks/design-task.md)\n'
  );
  assert.deepEqual(await kanbn.resolveTaskId('design'), { id: 'design', match: null });
  assert.deepEqual(
    await kanbn.withBoard('design').resolveTaskId('design-t'),
    { id: 'design-task', match: 'prefix' }
  );
});
