module.exports = (() => {
  const tags = {
    b: 'bold',
    d: 'dim'
  };

  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {

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
    },

    /**
     * Asynchronously wait for some time
     * @param {number} t The time to wait in seconds
     */
    async sleep(t) {
      await timeout(t * 1000);
    }
  }
})();
