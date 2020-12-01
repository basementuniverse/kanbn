const paramCase = require('param-case').paramCase;

module.exports = (() => {
  const tags = {
    b: 'bold',
    d: 'dim'
  };

  return {

    /**
     * Show an error message in the console
     * @param {Error} error
     */
    showError(error) {
      console.error(process.env.DEBUG === 'true' ? error : error.message);
    },

    /**
     * Get a task id from the task name
     * @param {string} name The task name
     * @return {string} The task id
     */
    getTaskId(name) {
      return paramCase(name);
    },

    /**
     * Convert an argument into a string. If the argument is an array of strings, use the last element
     * @param {string|string[]} arg An argument that might be a string or an array of strings
     * @return {string} The argument value
     */
    argToString(arg) {
      if (Array.isArray(arg)) {
        return arg.pop();
      }
      return arg;
    },

    /**
     * If a string starts and ends with '/', trim these characters
     * @param {string} s The regex string
     * @return {string} The trimmed regex
     */
    trimRegex(s) {
      if (s.startsWith('/') && s.endsWith('/')) {
        return s.substring(1, s.length - 1);
      }
      return s;
    },

    /**
     * Compare two dates using only the date part and ignoring time
     * @param {Date} a
     * @param {Date} b
     * @return {boolean} True if the dates are the same
     */
    compareDates(a, b) {
      const aDate = new Date(a), bDate = new Date(b);
      aDate.setHours(0, 0, 0, 0);
      bDate.setHours(0, 0, 0, 0);
      return aDate == bDate;
    },

    /**
     * Make a string bold
     * @param {string} s The string to wrap
     * @return {string} The updated string
     */
    bold(s) {
      return `\x1b[1m${s}\x1b[0m`;
    },

    /**
     * Make a string dim
     * @param {string} s The string to wrap
     * @return {string} The updated string
     */
    dim(s) {
      return `\x1b[2m${s}\x1b[0m`;
    },

    /**
     * Replace tags like {x}...{x} in a string
     * @param {string} s The string in which to replace tags
     * @return {string} The updated string
     */
    replaceTags(s) {
      for (tag in tags) {
        const r = new RegExp(`\{${tag}\}([^{]+)\{${tag}\}`, 'g');
        s = s.replace(r, (m, s) => this[tags[tag]](s));
      }
      return s;
    }
  }
})();
