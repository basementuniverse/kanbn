const mockFileSystem = require('mock-fs');
const kanbn = require('../../src/main');
const context = require('../context');

QUnit.module('initialise with custom config tests', {
  afterEach() {
    mockFileSystem.restore();
    kanbn.clearConfigCache();
  }
});

QUnit.test(
  'Initialise with advanced JSON config should create folders and index in custom location',
  async assert => {
    mockFileSystem({
      'kanbn.json': `{
        "mainFolder": "test-main-folder",
        "indexFile": "test-index.md",
        "taskFolder": "test-task-folder"
      }`
    });
    const BASE_PATH = await kanbn.getMainFolder();
    assert.equal(/test-main-folder$/.test(BASE_PATH), true);

    // Kanbn shouldn't be currently initialised in our mock filesystem
    assert.equal(await kanbn.initialised(), false);

    // Initialise kanbn and check that the main folder, index, and tasks folder exists
    await kanbn.initialise();
    context.kanbnFolderExists(assert, BASE_PATH);
    context.indexExists(assert, BASE_PATH, true, 'test-index.md');
    context.tasksFolderExists(assert, BASE_PATH, true, 'test-task-folder');

    // Kanbn should now be initialised
    assert.equal(await kanbn.initialised(), true);
  }
);

QUnit.test(
  'Initialise with advanced YAML config should create folders and index in custom location',
  async assert => {
    mockFileSystem({
      'kanbn.yml': `
        mainFolder: test-main-folder
        indexFile: test-index.md
        taskFolder: test-task-folder`
    });
    const BASE_PATH = await kanbn.getMainFolder();
    assert.equal(/test-main-folder$/.test(BASE_PATH), true);

    // Kanbn shouldn't be currently initialised in our mock filesystem
    assert.equal(await kanbn.initialised(), false);

    // Initialise kanbn and check that the main folder, index, and tasks folder exists
    await kanbn.initialise();
    context.kanbnFolderExists(assert, BASE_PATH);
    context.indexExists(assert, BASE_PATH, true, 'test-index.md');
    context.tasksFolderExists(assert, BASE_PATH, true, 'test-task-folder');

    // Kanbn should now be initialised
    assert.equal(await kanbn.initialised(), true);
  }
);
