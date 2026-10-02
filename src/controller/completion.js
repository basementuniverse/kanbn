const fs = require('fs');
const path = require('path');
const utility = require('../utility');

// The completion script for each supported shell, and how to load it
const SHELLS = {
  bash: {
    file: 'kanbn.bash',
    install: 'add {b}eval "$(kanbn completion bash)"{b} to ~/.bashrc'
  },
  zsh: {
    file: '_kanbn',
    install: 'add {b}eval "$(kanbn completion zsh)"{b} to ~/.zshrc, after compinit'
  },
  fish: {
    file: 'kanbn.fish',
    install: 'run {b}kanbn completion fish > ~/.config/fish/completions/kanbn.fish{b}'
  }
};

/**
 * Get the user's shell from $SHELL, if it's one that completion supports
 * @return {?string}
 */
function currentShell() {
  const shell = path.basename(process.env.SHELL || '');
  return shell in SHELLS ? shell : null;
}

/**
 * Get a one-line instruction for turning on completion in the user's shell
 * @return {?string} The instruction, or null if the shell isn't one that completion supports
 */
function installHint() {
  const shell = currentShell();
  return shell === null ? null : `To enable tab completion, ${SHELLS[shell].install}`;
}

module.exports = args => {
  const shell = args._[1];
  if (!shell) {
    utility.error(
      `No shell specified\nTry running {b}kanbn completion ${currentShell() || 'bash'}{b} - ` +
      `the shells supported are ${Object.keys(SHELLS).join(', ')}`
    );
    return;
  }
  if (!(shell in SHELLS)) {
    utility.error(`Completion isn't available for "${shell}" - try one of ${Object.keys(SHELLS).join(', ')}`);
    return;
  }
  process.stdout.write(fs.readFileSync(path.join(__dirname, '..', 'completion', SHELLS[shell].file), { encoding: 'utf-8' }));
};

module.exports.SHELLS = Object.keys(SHELLS);
module.exports.installHint = installHint;
