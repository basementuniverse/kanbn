const { execFileSync } = require('child_process');

/**
 * Get the git username of the current user, or null if it can't be found. This replaces the
 * git-user-name package, which depends on a version of parse-git-config with an unpatched
 * prototype pollution vulnerability
 * @return {string|null} The git username, or null if git isn't available or no username is set
 */
module.exports = () => {
  try {
    const username = execFileSync('git', ['config', 'user.name'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return username || null;
  } catch (error) {
    return null;
  }
};
