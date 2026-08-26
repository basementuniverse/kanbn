/**
 * Check if an async function throws an error
 *
 * This returns a promise and must be awaited: pushing the result against the assert instance that
 * the assertion was called with (rather than QUnit.config.current) keeps a missing await from
 * attributing the result to whichever test happens to be running when it settles, but the
 * assertion still needs to finish before its own test does.
 *
 * @param {Function} block The async function to call
 * @param {string|RegExp} expected The expected exception message
 * @param {string} message A message to display if the test fails
 */
QUnit.assert.throwsAsync = async function (block, expected, message) {
  const assert = this && typeof this.pushResult === 'function' ? this : QUnit.config.current.assert;
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
  assert.pushResult({
    result,
    actual: actual && actual.message,
    expected,
    message
  });
};
