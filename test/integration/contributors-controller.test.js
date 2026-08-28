const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('contributors controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.initialised = true;
    mockConfig.output = null;
  }
});

QUnit.test('List contributors without initialising kanbn', async assert => {
  mockConfig.initialised = false;
  const output = await capture.stderr(async () => {
    await mockArgv(['contributors'], kanbn);
  });

  assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('List contributors in a workspace that declares none', async assert => {
  mockConfig.currentUser = 'gordon';
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /No contributors are declared in this workspace/);
  assert.contains(output, /You are/);
  assert.contains(output, /gordon/);
});

QUnit.test('List contributors', async assert => {
  mockConfig.contributors = [
    'gordon',
    { name: 'dave', displayName: 'Dave Smith', email: 'dave@example.com', aliases: ['davesmith'] }
  ];
  mockConfig.currentUser = 'gordon';
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /2 contributors/);
  assert.contains(output, /gordon \(you\)/);
  assert.contains(output, /Dave Smith/);
  assert.contains(output, /dave@example\.com/);
  assert.contains(output, /also known as "davesmith"/);
});

QUnit.test('List contributors when kanbn cannot work out who you are', async assert => {
  mockConfig.contributors = ['gordon'];
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /can't work out who you are/);
});

QUnit.test('List contributors in JSON format', async assert => {
  mockConfig.contributors = ['gordon'];
  mockConfig.currentUser = 'gordon';
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors', '-j'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const result = JSON.parse(output);
  assert.equal(result.currentUser, 'gordon');
  assert.deepEqual(result.contributors, [{ name: 'gordon', displayName: 'gordon', aliases: [] }]);
});

QUnit.test('Show contributor usage', async assert => {
  mockConfig.currentUser = 'gordon';
  mockConfig.contributorUsage = {
    contributors: [
      {
        name: 'gordon',
        displayName: 'gordon',
        aliases: [],
        assigned: 3,
        comments: 1,
        tasks: 3,
        spellings: [
          { value: 'gordon', assigned: 2, comments: 1, tasks: ['task-1', 'task-2'] },
          { value: 'Gordon', assigned: 1, comments: 0, tasks: ['task-3'] }
        ]
      }
    ],
    unknown: [
      { value: 'Steve', assigned: 1, comments: 0, tasks: ['task-4'] }
    ]
  };
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors', '--usage'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /3 tasks, assigned 3, 1 comment/);
  assert.contains(output, /written as "Gordon" in 1 task/);
  assert.contains(output, /1 name is used in tasks but isn't a known contributor/);
  assert.contains(output, /Steve/);
  assert.contains(output, /task-4/);
});

QUnit.test('Show contributor usage with nothing unknown', async assert => {
  mockConfig.contributorUsage = {
    contributors: [
      { name: 'gordon', displayName: 'gordon', aliases: [], assigned: 1, comments: 0, tasks: 1, spellings: [] }
    ],
    unknown: []
  };
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors', '-u'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  assert.contains(output, /Every name used in a task matches a contributor/);
});

QUnit.test('Show contributor usage in JSON format', async assert => {
  mockConfig.currentUser = 'gordon';
  mockConfig.contributorUsage = { contributors: [], unknown: [{ value: 'Steve', assigned: 1, comments: 0, tasks: ['task-4'] }] };
  const output = await capture.stdout(async out => {
    await mockArgv(['contributors', '-u', '-j'], kanbn);
    await capture.waitFor(() => out.length > 0);
  });

  const result = JSON.parse(output);
  assert.equal(result.currentUser, 'gordon');
  assert.deepEqual(result.unknown, [{ value: 'Steve', assigned: 1, comments: 0, tasks: ['task-4'] }]);
});

QUnit.test('Show an error if the usage report fails', async assert => {
  mockConfig.errors.getContributorUsage = 'Not initialised in this folder';
  const output = await capture.stderr(async () => {
    await mockArgv(['contributors', '--usage'], kanbn);
  });

  assert.contains(output, /Not initialised in this folder/);
});
