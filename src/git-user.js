const { execFileSync } = require('child_process');

// Reading a git config value means spawning a process, and the current user is resolved from prompt
// defaults that run in loops. The values can't change while a command is running, so they're read at
// most once each per process
const memo = {};

/**
 * Read a value from git config, or null if it can't be read. This replaces the git-user-name
 * package, which depends on a version of parse-git-config with an unpatched prototype pollution
 * vulnerability
 * @param {string} key The git config key
 * @return {?string} The value, or null if git isn't available or the value isn't set
 */
function gitConfig(key) {
  if (!(key in memo)) {
    try {
      memo[key] = execFileSync('git', ['config', key], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim() || null;
    } catch (error) {
      memo[key] = null;
    }
  }
  return memo[key];
}

module.exports = {

  /**
   * Get the git username of the current user, or null if it can't be found
   * @return {?string} The git username
   */
  name() {
    return gitConfig('user.name');
  },

  /**
   * Get the git email address of the current user, or null if it can't be found
   * @return {?string} The git email address
   */
  email() {
    return gitConfig('user.email');
  },

  /**
   * Forget the memoized values. Only useful in tests, where git config is faked per case
   */
  clearCache() {
    for (const key of Object.keys(memo)) {
      delete memo[key];
    }
  }
};
