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
      console.log(process.env.DEBUG ? error : error.message);
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
