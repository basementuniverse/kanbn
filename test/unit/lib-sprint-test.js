const mockFileSystem = require('mock-fs');
const kanbn = require('../../lib/main');
const context = require('../context');

QUnit.module('Library sprint tests', {
  before() {
    require('../qunit-throws-async');
  },
  beforeEach() {
    mockFileSystem();
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Start a sprint in uninitialised folder', async assert => {
  assert.throwsAsync(
    async () => {
      await kanbn.sprint('Sprint 1', '', new Date());
    },
    /Not initialised in this folder/
  );
});

QUnit.test('Start a sprint', async assert => {
  const SPRINT_NAME = 'Test Sprint';
  const SPRINT_DESCRIPTION = 'Test description...';
  const SPRINT_DATE = new Date();

  // Initialise kanbn
  await kanbn.initialise();

  // Start a sprint
  await kanbn.sprint(SPRINT_NAME, SPRINT_DESCRIPTION, SPRINT_DATE);

  // Verify that the sprint exists
  context.indexHasOptions(assert, kanbn.getMainFolder(), {
    sprints: [
      {
        name: SPRINT_NAME,
        description: SPRINT_DESCRIPTION,
        start: SPRINT_DATE
      }
    ]
  });
});

QUnit.test('Start a sprint with auto-generated name', async assert => {
  const BASE_PATH = kanbn.getMainFolder();
  const SPRINT_DATE = new Date();

  // Initialise kanbn
  await kanbn.initialise();

  // Start a sprint without a name or description
  await kanbn.sprint('', '', SPRINT_DATE);

  // Verify that the sprint exists
  context.indexHasOptions(assert, BASE_PATH, {
    sprints: [
      {
        name: 'Sprint 1',
        start: SPRINT_DATE
      }
    ]
  });

  // Start another sprint
  await kanbn.sprint('', '', SPRINT_DATE);

  // Verify that the new sprint exists
  context.indexHasOptions(assert, BASE_PATH, {
    sprints: [
      {
        name: 'Sprint 1',
        start: SPRINT_DATE
      },
      {
        name: 'Sprint 2',
        start: SPRINT_DATE
      }
    ]
  });
});
