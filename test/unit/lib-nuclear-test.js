const mockFileSystem = require('mock-fs');
const kanbn = require('../../lib/main');
const context = require('./context');

QUnit.module('Kanbn library nuclear tests', {
  beforeEach() {
    require('./fixtures')({
      tasks: 1
    });
  },
  afterEach() {
    mockFileSystem.restore();
  }
});

QUnit.test('Nuke kanbn', async assert => {
  const BASE_PATH = kanbn.getMainFolder();

  // Kanbn should be initialised
  assert.equal(await kanbn.initialised(), true);

  // Nuke kanbn
  await kanbn.nuclear();

  // Kanbn should not be initialised
  assert.equal(await kanbn.initialised(), false);

  // Verify that the index and folders have been removed
  context.indexExists(assert, BASE_PATH, true);
  context.kanbnFolderExists(assert, BASE_PATH, true);
  context.tasksFolderExists(assert, BASE_PATH, true);
});
