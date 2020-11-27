const mockFileSystem = require('mock-fs');
const kanbn = require('../../lib/main');

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

  // Kanbn should be initialised
  assert.equal(await kanbn.initialised(), true);

  // Nuke kanbn
  await kanbn.nuclear();

  // Kanbn should not be initialised
  assert.equal(await kanbn.initialised(), false);
});
