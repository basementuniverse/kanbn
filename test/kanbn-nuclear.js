const mock = require('mock-fs');
const kanbn = require('../lib/main');

QUnit.module('Kanbn nuclear tests', {
  beforeEach() {
    require('./fixtures')();
  },
  afterEach() {
    mock.restore();
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
