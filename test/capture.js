const captureConsole = require('capture-console');

/**
 * Helpers for capturing controller output.
 *
 * Interception replaces stream.write, so a test that throws between startIntercept and
 * stopIntercept swallows everything written afterwards - including QUnit's own TAP stream, which
 * makes the rest of the run look like it silently vanished. Prefer the helpers below, which always
 * release the stream, and release both streams after every test as a safety net.
 */

QUnit.testDone(() => {
  captureConsole.stopIntercept(process.stdout);
  captureConsole.stopIntercept(process.stderr);
});

/**
 * Run a block with a stream intercepted and return everything written to it
 *
 * The block is passed the array that output is being collected into, so that a controller which
 * writes from an unawaited promise chain can be waited on with waitFor()
 * @param {NodeJS.WriteStream} stream The stream to intercept
 * @param {Function} block The (possibly async) function to run
 * @return {Promise<string[]>} The chunks written to the stream
 */
async function captureStream(stream, block) {
  const output = [];
  captureConsole.startIntercept(stream, s => {
    output.push(s);
  });
  try {
    await block(output);
  } finally {
    captureConsole.stopIntercept(stream);
  }
  return output;
}

/**
 * Wait for a condition to become true
 *
 * Some controllers write their output from a promise chain that isn't awaited, so the output can
 * land a few ticks after the controller returns
 * @param {Function} condition Called repeatedly until it returns true
 * @param {number} [timeout=2000] How long to wait before giving up, in milliseconds
 * @return {Promise<boolean>} True if the condition became true before the timeout
 */
async function waitFor(condition, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return condition();
}

module.exports = {
  captureStream,
  waitFor,

  /**
   * Run a block and return everything it wrote to stdout
   * @param {Function} block The (possibly async) function to run
   * @return {Promise<string[]>} The chunks written to stdout
   */
  stdout: block => captureStream(process.stdout, block),

  /**
   * Run a block and return everything it wrote to stderr
   * @param {Function} block The (possibly async) function to run
   * @return {Promise<string[]>} The chunks written to stderr
   */
  stderr: block => captureStream(process.stderr, block)
};
