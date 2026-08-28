const gitUser = require('./git-user');

/**
 * Get the git username of the current user, or null if it can't be found
 *
 * Kept as a named module because it was the public entry point before git-user.js existed
 * @return {string|null} The git username, or null if git isn't available or no username is set
 */
module.exports = () => gitUser.name();
