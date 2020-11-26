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
