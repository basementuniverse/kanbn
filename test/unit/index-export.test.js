const path = require('path');

QUnit.module('index export tests');

QUnit.test('Kanbn class is exported from the package entry point', async assert => {
  const { Kanbn } = require('../../index');
  assert.equal(typeof Kanbn, 'function');
  assert.equal(Kanbn, require('../../src/main').Kanbn);
});

QUnit.test('Requiring the package entry point does not load the library', async assert => {
  const { execFileSync } = require('child_process');
  const loaded = execFileSync(process.execPath, [
    '-e',
    `require(${JSON.stringify(path.join(__dirname, '../../index'))});` +
    `console.log(Object.keys(require.cache).some(f => f.endsWith(${JSON.stringify(path.join('src', 'main.js'))})))`
  ]).toString().trim();
  assert.equal(loaded, 'false');
});
