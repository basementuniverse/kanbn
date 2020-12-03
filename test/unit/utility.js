/**
 * Check if an async function throws an error
 * @param {Function} block The async function to call
 * @param {string|RegExp} expected The expected exception message
 * @param {string} message A message to display if the test fails
 */
QUnit.assert.throwsAsync = async (block, expected, message) => {
  let actual, result = false;
  try {
    await block();
  } catch (error) {
    actual = error;
  }
  if (actual) {
    if (!expected) {
      result = true;
    } else if (expected instanceof RegExp) {
      result = expected.test(actual.message);
      expected = expected.toString();
    } else {
      result = expected === actual.message;
    }
  }
  QUnit.config.current.assert.pushResult({
    result,
    actual: actual && actual.message,
    expected,
    message
  });
};
