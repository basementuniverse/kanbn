const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kanbn } = require('../../src/main');
const gitUser = require('../../src/git-user');
const parseIndex = require('../../src/parse-index');

// Real temporary directories rather than mock-fs, so these exercise the same filesystem paths the
// CLI uses
const roots = [];

// git identity is a property of the machine the tests happen to run on, so it's stubbed rather than
// read. main.js holds the module object, so replacing the functions on it is enough
const realGitUser = { name: gitUser.name, email: gitUser.email };

function setGitUser(name, email = null) {
  gitUser.name = () => name;
  gitUser.email = () => email;
}

/**
 * Create a workspace, optionally with a kanbn.yml config file
 * @param {object} [options={}] Options for the main board
 * @param {?object} [config=null] Config file contents, or null for front matter only
 * @return {Promise<Kanbn>}
 */
async function setup(options = {}, config = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-contributors-'));
  roots.push(root);
  const kanbn = new Kanbn(root);
  await kanbn.initialise({
    name: 'Test Project',
    options: config === null ? options : {},
    columns: ['Todo', 'Done']
  });
  if (config !== null) {
    fs.writeFileSync(path.join(root, 'kanbn.json'), JSON.stringify(config, null, 2));
    kanbn.clearConfigCache();
  }
  return kanbn;
}

QUnit.module('contributors tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    delete process.env.KANBN_USER;
    setGitUser(null, null);
  },
  after() {
    Object.assign(gitUser, realGitUser);
    delete process.env.KANBN_USER;
    while (roots.length) {
      fs.rmSync(roots.pop(), { recursive: true, force: true });
    }
  }
});

QUnit.test('normaliseContributors should accept bare names and objects in the same list', async assert => {
  const kanbn = await setup();
  assert.deepEqual(
    kanbn.normaliseContributors([
      'gordon',
      { name: 'dave', displayName: 'Dave Smith', email: 'dave@example.com', aliases: ['davesmith'], colour: '#fff' }
    ]),
    [
      { name: 'gordon', displayName: 'gordon', aliases: [] },
      {
        name: 'dave',
        displayName: 'Dave Smith',
        aliases: ['davesmith'],
        email: 'dave@example.com',
        colour: '#fff'
      }
    ]
  );
});

QUnit.test('normaliseContributors should ignore entries without a usable name', async assert => {
  const kanbn = await setup();
  assert.deepEqual(kanbn.normaliseContributors(['  ', null, 42, {}, { name: '  ' }, 'sam']), [
    { name: 'sam', displayName: 'sam', aliases: [] }
  ]);
  assert.deepEqual(kanbn.normaliseContributors(undefined), []);
  assert.deepEqual(kanbn.normaliseContributors('gordon'), []);
});

QUnit.test('getContributors should read contributors from the main board front matter', async assert => {
  const kanbn = await setup({ contributors: ['gordon', 'dave'] });
  assert.deepEqual((await kanbn.getContributors()).map(c => c.name), ['gordon', 'dave']);
});

QUnit.test('getContributors should read contributors from the config file', async assert => {
  const kanbn = await setup({}, { contributors: [{ name: 'sam', aliases: ['Sam Vimes'] }] });
  const contributors = await kanbn.getContributors();
  assert.equal(contributors.length, 1);
  assert.deepEqual(contributors[0], { name: 'sam', displayName: 'sam', aliases: ['Sam Vimes'] });
});

QUnit.test('contributors should be inherited by secondary boards', async assert => {
  const kanbn = await setup({ contributors: ['gordon'] });
  await kanbn.board('design').initialise({ name: 'Design', columns: ['Ideas'] });
  const index = await kanbn.board('design').getIndex();
  assert.deepEqual(index.options.contributors, ['gordon']);
  assert.deepEqual((await kanbn.board('design').getContributors()).map(c => c.name), ['gordon']);
});

QUnit.test('findContributor should match name, display name and aliases regardless of case', async assert => {
  const kanbn = await setup({
    contributors: [{ name: 'gordon', displayName: 'Gordon Larrigan', aliases: ['gordonl'] }]
  });
  for (const value of ['gordon', 'GORDON', 'Gordon Larrigan', 'gordon larrigan', 'gordonl']) {
    const contributor = await kanbn.findContributor(value);
    assert.equal(contributor && contributor.name, 'gordon', `"${value}" should resolve to gordon`);
  }
  assert.equal(await kanbn.findContributor('someone else'), null);
  assert.equal(await kanbn.findContributor(''), null);
  assert.equal(await kanbn.findContributor(null), null);
});

QUnit.test('currentUser should use KANBN_USER verbatim', async assert => {
  const kanbn = await setup({ contributors: [{ name: 'gordon', aliases: ['Gordon Larrigan'] }] });
  setGitUser('Gordon Larrigan', 'gordon@example.com');
  process.env.KANBN_USER = '  Gordon Larrigan  ';
  assert.equal(await kanbn.currentUser(), 'Gordon Larrigan');
});

QUnit.test('currentUser should canonicalise a git email to a contributor name', async assert => {
  const kanbn = await setup({
    contributors: ['dave', { name: 'gordon', email: 'Gordon@Example.com' }]
  });
  setGitUser('Somebody Else', 'gordon@example.com');
  assert.equal(await kanbn.currentUser(), 'gordon');
});

QUnit.test('currentUser should canonicalise a git username to a contributor name', async assert => {
  const kanbn = await setup({
    contributors: [{ name: 'gordon', aliases: ['Gordon Larrigan'] }]
  });
  setGitUser('gordon larrigan', 'not-in-the-list@example.com');
  assert.equal(await kanbn.currentUser(), 'gordon');
});

QUnit.test('currentUser should fall back to the git username', async assert => {
  const withContributors = await setup({ contributors: ['dave'] });
  setGitUser('Gordon Larrigan', 'gordon@example.com');
  assert.equal(await withContributors.currentUser(), 'Gordon Larrigan');

  const withoutContributors = await setup();
  assert.equal(await withoutContributors.currentUser(), 'Gordon Larrigan');
});

QUnit.test('currentUser should be null when there is nothing to go on', async assert => {
  const kanbn = await setup({ contributors: ['gordon'] });
  assert.equal(await kanbn.currentUser(), null);
});

QUnit.test('currentUser should work in a folder that has not been initialised', async assert => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbn-contributors-'));
  roots.push(root);
  setGitUser('Gordon Larrigan', 'gordon@example.com');
  assert.equal(await new Kanbn(root).currentUser(), 'Gordon Larrigan');
});

QUnit.test('getContributorUsage should report usage per contributor and unknown names', async assert => {
  const kanbn = await setup({
    contributors: [{ name: 'gordon', aliases: ['Gordon Larrigan'] }, 'dave']
  });
  await kanbn.createTask({ name: 'Task One', metadata: { assigned: 'gordon' } }, 'Todo');
  await kanbn.createTask({ name: 'Task Two', metadata: { assigned: 'Gordon Larrigan' } }, 'Todo');
  await kanbn.createTask({ name: 'Task Three', metadata: { assigned: 'Steve' } }, 'Todo');
  await kanbn.comment('task-three', 'A comment', 'dave');

  const usage = await kanbn.getContributorUsage();
  const gordon = usage.contributors.find(c => c.name === 'gordon');
  assert.equal(gordon.assigned, 2);
  assert.equal(gordon.tasks, 2);
  assert.deepEqual(gordon.spellings.map(s => s.value).sort(), ['Gordon Larrigan', 'gordon']);

  const dave = usage.contributors.find(c => c.name === 'dave');
  assert.equal(dave.assigned, 0);
  assert.equal(dave.comments, 1);
  assert.equal(dave.tasks, 1);

  assert.equal(usage.unknown.length, 1);
  assert.equal(usage.unknown[0].value, 'Steve');
  assert.deepEqual(usage.unknown[0].tasks, ['task-three']);
});

QUnit.test('findContributorWarnings should report unknown names, one per task', async assert => {
  const kanbn = await setup({ contributors: ['gordon'] });
  await kanbn.createTask({ name: 'Task One', metadata: { assigned: 'gordon' } }, 'Todo');
  await kanbn.createTask({ name: 'Task Two', metadata: { assigned: 'Steve' } }, 'Todo');
  await kanbn.createTask({ name: 'Task Three', metadata: { assigned: 'Steve' } }, 'Todo');

  const warnings = await kanbn.findContributorWarnings();
  assert.deepEqual(warnings.map(w => w.task), ['task-three', 'task-two']);
  assert.equal(warnings[0].type, 'unknown-contributor');
  assert.equal(warnings[0].value, 'Steve');
});

QUnit.test('findContributorWarnings should report nothing when no contributors are declared', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Task One', metadata: { assigned: 'Anybody At All' } }, 'Todo');
  assert.deepEqual(await kanbn.findContributorWarnings(), []);
});

QUnit.test('history events should record the current user as their author', async assert => {
  const kanbn = await setup({ contributors: [{ name: 'gordon', aliases: ['Gordon Larrigan'] }] });
  setGitUser('Gordon Larrigan', 'gordon@example.com');
  await kanbn.createTask({ name: 'Task One' }, 'Todo');
  await kanbn.moveTask('task-one', 'Done');
  const task = await kanbn.getTask('task-one');
  assert.deepEqual(task.history.map(event => event.author), ['gordon', 'gordon']);
});

QUnit.test('history events should carry no author when there is no current user', async assert => {
  const kanbn = await setup();
  await kanbn.createTask({ name: 'Task One' }, 'Todo');
  const task = await kanbn.getTask('task-one');
  assert.equal(task.history.length, 1);
  assert.notOk('author' in task.history[0]);
});

QUnit.test('a contributors list should be accepted in both shapes and validated', assert => {
  const index = parseIndex.md2json(
    '---\ncontributors:\n  - gordon\n  - name: dave\n    aliases:\n      - Dave Smith\n---\n\n# Test\n\n## Todo\n'
  );
  assert.deepEqual(index.options.contributors, ['gordon', { name: 'dave', aliases: ['Dave Smith'] }]);
  assert.throws(
    () => parseIndex.md2json('---\ncontributors:\n  - name: 5\n---\n\n# Test\n\n## Todo\n'),
    /Unable to parse index/
  );
  assert.throws(
    () => parseIndex.md2json('---\ncontributors:\n  - displayName: dave\n---\n\n# Test\n\n## Todo\n'),
    /Unable to parse index/
  );
});
