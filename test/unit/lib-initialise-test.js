const mockFileSystem = require('mock-fs');
const fs = require('fs');
const path = require('path');
const kanbn = require('../../lib/main');

QUnit.module('Kanbn library initialise tests', {
  beforeEach() {
    mockFileSystem();
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Initialise with default settings', async assert => {

  // Kanbn shouldn't be currently initialised in our mock filesystem
  assert.equal(await kanbn.initialised(), false);

  // Initialise kanbn and check that the main folder, index, and tasks folder exists
  await kanbn.initialise();
  await fs.promises.access(kanbn.getMainFolder(), fs.constants.R_OK | fs.constants.W_OK);
  await fs.promises.access(path.join(kanbn.getMainFolder(), 'index.md'), fs.constants.R_OK | fs.constants.W_OK);
  await fs.promises.access(path.join(kanbn.getMainFolder(), 'tasks'), fs.constants.R_OK | fs.constants.W_OK);

  // The index should contain some text
  assert.equal((await fs.promises.readFile(path.join(kanbn.getMainFolder(), 'index.md'))).length > 0, true);

  // Kanbn should now be initialised
  assert.equal(await kanbn.initialised(), true);

  // Check for default name & columns
  const index = await kanbn.getIndex();
  assert.equal(index.name, 'Project Name');
  assert.deepEqual(Object.keys(index.columns), ['Backlog', 'Todo', 'In Progress', 'Done', 'Archive']);
});

QUnit.test('Initialise with custom settings', async assert => {

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
  await fs.promises.access(kanbn.getMainFolder(), fs.constants.R_OK | fs.constants.W_OK);
  await fs.promises.access(path.join(kanbn.getMainFolder(), 'index.md'), fs.constants.R_OK | fs.constants.W_OK);
  await fs.promises.access(path.join(kanbn.getMainFolder(), 'tasks'), fs.constants.R_OK | fs.constants.W_OK);

  // The index should contain some text
  assert.equal((await fs.promises.readFile(path.join(kanbn.getMainFolder(), 'index.md'))).length > 0, true);

  // Kanbn should now be initialised
  assert.equal(await kanbn.initialised(), true);

  // Check for custom name, description & columns
  const index = await kanbn.getIndex();
  assert.equal(index.name, CUSTOM_NAME);
  assert.equal(index.description, CUSTOM_DESCRIPTION)
  assert.deepEqual(Object.keys(index.columns), CUSTOM_COLUMNS);
});

QUnit.test('Reinitialise with additional settings', async assert => {

  // Kanbn shouldn't be currently initialised in our mock filesystem
  assert.equal(await kanbn.initialised(), false);

  // Initialise kanbn and check that the main folder, index, and tasks folder exists
  await kanbn.initialise();
  await fs.promises.access(kanbn.getMainFolder(), fs.constants.R_OK | fs.constants.W_OK);
  await fs.promises.access(path.join(kanbn.getMainFolder(), 'index.md'), fs.constants.R_OK | fs.constants.W_OK);
  await fs.promises.access(path.join(kanbn.getMainFolder(), 'tasks'), fs.constants.R_OK | fs.constants.W_OK);

  // The index should contain some text
  assert.equal((await fs.promises.readFile(path.join(kanbn.getMainFolder(), 'index.md'))).length > 0, true);

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
  const index = await kanbn.getIndex();
  assert.equal(index.name, CUSTOM_NAME);
  assert.equal(index.description, CUSTOM_DESCRIPTION)
  assert.deepEqual(Object.keys(index.columns), [
    'Backlog',
    'Todo',
    'In Progress',
    'Done',
    'Archive',
    ...CUSTOM_COLUMNS
  ]);
});
