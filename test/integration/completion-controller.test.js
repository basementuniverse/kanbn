const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const capture = require('../capture');
const {
  config: mockConfig,
  kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

/**
 * Run a block with $SHELL set to something, putting it back afterwards
 * @param {?string} shell
 * @param {Function} block
 */
async function withShell(shell, block) {
  const previous = process.env.SHELL;
  if (shell === null) {
    delete process.env.SHELL;
  } else {
    process.env.SHELL = shell;
  }
  try {
    return await block();
  } finally {
    if (previous === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = previous;
    }
  }
}

QUnit.module('completion controller tests', {
  before() {
    require('../qunit-contains');
    mockRequire('../../src/main', mockKanbn);
    kanbn = require('../../index');
  },
  beforeEach() {
    mockConfig.reset();
    mockConfig.output = null;
  }
});

QUnit.test('Each supported shell should print its completion script', async assert => {
  const expected = {
    bash: /complete -F _kanbn_completions kanbn/,
    zsh: /^#compdef kanbn/,
    fish: /complete -c kanbn -f -a '\(__kanbn_complete\)'/
  };
  for (const [shell, pattern] of Object.entries(expected)) {
    const output = await capture.stdout(async () => {
      await mockArgv(['completion', shell], kanbn);
    });
    assert.contains(output, pattern, shell);
    assert.contains(output, /kanbn __complete --/, shell);
  }
});

QUnit.test('No shell should say which shells are supported, suggesting the current one', async assert => {
  const output = await withShell('/usr/bin/zsh', () => capture.stderr(async () => {
    await mockArgv(['completion'], kanbn);
  }));
  assert.contains(output, /No shell specified/);
  assert.contains(output, /kanbn completion zsh/);
  assert.contains(output, /bash, zsh, fish/);
});

QUnit.test('An unsupported shell should be an error', async assert => {
  const output = await capture.stderr(async () => {
    await mockArgv(['completion', 'tcsh'], kanbn);
  });
  assert.contains(output, /Completion isn't available for "tcsh"/);
});

QUnit.test('init should say how to enable completion in the current shell', async assert => {
  mockConfig.initialised = false;
  const output = await withShell('/bin/bash', () => capture.stdout(async out => {
    await mockArgv(['init'], kanbn);
    await capture.waitFor(() => out.some(line => /tab completion/.test(line)), 500);
  }));
  assert.contains(output, /Initialised empty kanbn board/);
  assert.contains(output, /To enable tab completion, add .*eval "\$\(kanbn completion bash\)".* to ~\/\.bashrc/);
});

QUnit.test('init should not mention completion for a shell it doesn\'t support', async assert => {
  mockConfig.initialised = false;
  const output = await withShell('/bin/tcsh', () => capture.stdout(async out => {
    await mockArgv(['init'], kanbn);
    await capture.waitFor(() => out.length > 0, 500);
    await capture.waitFor(() => false, 50);
  }));
  assert.contains(output, /Initialised empty kanbn board/);
  assert.notOk(output.some(line => /completion/.test(line)));
});

QUnit.test('Reinitialising should not mention completion again', async assert => {
  mockConfig.initialised = true;
  const output = await withShell('/bin/bash', () => capture.stdout(async out => {
    await mockArgv(['init'], kanbn);
    await capture.waitFor(() => out.length > 0, 500);
    await capture.waitFor(() => false, 50);
  }));
  assert.contains(output, /Reinitialised existing kanbn board/);
  assert.notOk(output.some(line => /completion/.test(line)));
});
