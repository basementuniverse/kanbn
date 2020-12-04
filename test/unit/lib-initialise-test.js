const mockFileSystem = require('mock-fs');
const kanbn = require('../../lib/main');
const context = require('./context');

QUnit.module('Kanbn library initialise tests', {
  beforeEach() {
    mockFileSystem();
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Initialise with default settings', async assert => {
  const BASE_PATH = kanbn.getMainFolder();

  // Kanbn shouldn't be currently initialised in our mock filesystem
  assert.equal(await kanbn.initialised(), false);

  // Initialise kanbn and check that the main folder, index, and tasks folder exists
  await kanbn.initialise();
  context.kanbnFolderExists(assert, BASE_PATH);
  context.indexExists(assert, BASE_PATH);
  context.tasksFolderExists(assert, BASE_PATH);

  // Kanbn should now be initialised
  assert.equal(await kanbn.initialised(), true);

  // Check for default name & columns
  context.indexHasName(assert, BASE_PATH, 'Project Name');
  context.indexHasColumns(assert, BASE_PATH, ['Backlog', 'Todo', 'In Progress', 'Done']);
});

QUnit.test('Initialise with custom settings', async assert => {
  const BASE_PATH = kanbn.getMainFolder();

  // Kanbn shouldn't be currently initialised in our mock filesystem
  assert.equal(await kanbn.initialised(), false);

  // Initialise kanbn and check that the main folder, index, and tasks folder exists
  const CUSTOM_NAME = 'Custom Project Name';
  const CUSTOM_DESCRIPTION = 'Custom project description...';
  const CUSTOM_COLUMNS = [
    'Column 1',
    'Column 2',
    'Column 3'
  ];
  await kanbn.initialise({
    name: CUSTOM_NAME,
    description: CUSTOM_DESCRIPTION,
    columns: CUSTOM_COLUMNS
  });
  context.kanbnFolderExists(assert, BASE_PATH);
  context.indexExists(assert, BASE_PATH);
  context.tasksFolderExists(assert, BASE_PATH);

  // Kanbn should now be initialised
  assert.equal(await kanbn.initialised(), true);

  // Check for custom name, description & columns
  context.indexHasName(assert, BASE_PATH, CUSTOM_NAME);
  context.indexHasDescription(assert, BASE_PATH, CUSTOM_DESCRIPTION);
  context.indexHasColumns(assert, BASE_PATH, CUSTOM_COLUMNS);
});

QUnit.test('Reinitialise with additional settings', async assert => {
  const BASE_PATH = kanbn.getMainFolder();

  // Kanbn shouldn't be currently initialised in our mock filesystem
  assert.equal(await kanbn.initialised(), false);

  // Initialise kanbn and check that the main folder, index, and tasks folder exists
  await kanbn.initialise();
  context.kanbnFolderExists(assert, BASE_PATH);
  context.indexExists(assert, BASE_PATH);
  context.tasksFolderExists(assert, BASE_PATH);

  // Kanbn should now be initialised
  assert.equal(await kanbn.initialised(), true);

  // Reinitialise kanbn with additional settings
  const CUSTOM_NAME = 'Custom Project Name';
  const CUSTOM_DESCRIPTION = 'Custom project description...';
  const CUSTOM_COLUMNS = [
    'Column 1',
    'Column 2',
    'Column 3'
  ];
  await kanbn.initialise({
    name: CUSTOM_NAME,
    description: CUSTOM_DESCRIPTION,
    columns: CUSTOM_COLUMNS
  });

  // Kanbn should still be initialised
  assert.equal(await kanbn.initialised(), true);

  // Check for custom name, description & columns
  context.indexHasName(assert, BASE_PATH, CUSTOM_NAME);
  context.indexHasDescription(assert, BASE_PATH, CUSTOM_DESCRIPTION);
  context.indexHasColumns(assert, BASE_PATH, [
    'Backlog',
    'Todo',
    'In Progress',
    'Done',
    ...CUSTOM_COLUMNS
  ]);
});
