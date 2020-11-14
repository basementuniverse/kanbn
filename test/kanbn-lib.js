const { assert } = require('qunit');
const mock = require('mock-fs');
const fs = require('fs');
const path = require('path');
const kanbn = require('../lib/main');

QUnit.module('Kanbn library operations', {
  before() {
    mock();
  },
  after() {
    mock.restore();
  }
});

QUnit.test('Initialise', async assert => {

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
});
