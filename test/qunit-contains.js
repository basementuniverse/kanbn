const stripAnsi = require('strip-ansi');

/**
 * Check if an array contains a matching string
 * @param {string[]} input The input array to search
 * @param {string|RegExp} expected The string or regex we expect to find in the array
 * @param {string} message A message to display if the test fails
 */
QUnit.assert.contains = async (input, expected, message) => {
  if (typeof expected === 'string') {
    expected = new RegExp(expected);
  }
  let result = false;
  for (let i of input) {
    if (expected.test(stripAnsi(i))) {
      result = true;
      break;
    }
  }
  QUnit.config.current.assert.pushResult({
    result,
    actual: input.map(stripAnsi).join('\n'),
    expected,
    message
  });
};
