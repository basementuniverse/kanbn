module.exports = (() => {
  const tags = {
    b: 'bold',
    d: 'dim'
  };

  return {

    /**
     * Show an error message in the console
     * @param {Error|string} error
     * @param {boolean} dontExit
     */
    error(error, dontExit = false) {
      const message = error instanceof Error
        ? (process.env.DEBUG === 'true' ? error : this.replaceTags(error.message))
        : this.replaceTags(error);
      console.error(message);
      !dontExit && process.env.KANBN_ENV !== 'test' && process.exit(1);
    },

    /**
     * Show a hint about tasks whose dates don't match the column they're in. Hints are suppressed
     * for machine-readable output and when the board sets verbose to false
     * @param {object[]} drift Drift entries from kanbn.getDateDrift()
     * @param {boolean} show False to suppress the hint
     */
    showDateDriftHint(drift, show = true) {
      if (!show || !drift.length) {
        return;
      }
      const fixable = drift.filter(d => d.fixable).length;
      const summary =
        `${drift.length} ${drift.length === 1 ? 'task has' : 'tasks have'} dates that don't match ` +
        `${drift.length === 1 ? 'its' : 'their'} column`;
      console.log(this.replaceTags(
        `\n{d}${summary}${fixable ? ' - run{d} {b}kanbn validate --fix{b}' : '{d}'}` +
        (fixable ? ` {d}to fill in the missing ${fixable === 1 ? 'date' : 'dates'}{d}` : '')
      ));
    },

    /**
     * Convert a string to simplified paramcase, e.g:
     *  PascalCase -> pascalcase
     *  Test Word -> test-word
     * @param {string} s The string to convert
     * @return {string} The converted string
     */
    paramCase(s) {
      return s
        .replace(
          /([A-Z]+(.))/g,
          (_, separator, letter, offset) => (offset ? "-" + separator : separator).toLowerCase()
        )
        .split(/[\s!?.,@:;|\\/"'`£$%\^&*{}[\]()<>~#+\-=_¬]+/g)
        .join('-')
        .replace(/(^-|-$)/g, '')
        // The word-boundary replacement above only matches an uppercase run that is followed by
        // another character, so a trailing capital ("Task A" -> "task-A") and any non-ASCII capital
        // ("Ünïcodé" -> "Ünïcodé") would otherwise survive. Board slugs use this function, so ids
        // must be lowercase throughout.
        .toLowerCase();
    },

    /**
     * Get a task id from the task name
     * @param {string} name The task name
     * @return {string} The task id
     */
     getTaskId(name) {
      return this.paramCase(name);
    },

    /**
     * Convert an argument into a string. If the argument is an array of strings, concatenate them or use the
     * last element
     * @param {string|string[]} arg An argument that might be a string or an array of strings
     * @return {string} The argument value as a string
     */
    strArg(arg, all = false) {
      if (Array.isArray(arg)) {
        return all ? arg.join(',') : arg.pop();
      }
      return arg;
    },

    /**
     * Convert an argument into an array. If the argument is a string, return it as a single-element array
     * @param {string|string[]} arg An argument that might be a string or an array of strings
     * @return {string[]} The argument value as an array
     */
    arrayArg(arg) {
      if (Array.isArray(arg)) {
        return arg;
      }
      return [arg];
    },

    /**
     * Remove escape characters ('/' and '\') from the beginning of a string
     * @param {string} s The string to trim
     */
    trimLeftEscapeCharacters(s) {
      return s.replace(/^[\\\/]+/, '');
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
      return aDate.getTime() == bDate.getTime();
    },

    /**
     * If a is undefined, convert it to a number or string depending on the specified type
     * @param {*} a
     * @param {string} type
     * @return {string|number}
     */
    coerceUndefined(a, type) {
      if (a === undefined) {
        switch (type) {
          case 'string':
            return '';
          default:
            return 0;
        }
      }
      return a;
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
    },

    /**
     * Coerce a terminal width into a usable number. The terminal width is unavailable when stdout
     * isn't a TTY (i.e. when the output is piped or redirected), so fall back to a default
     * @param {any} width The reported terminal width
     * @param {number} [fallback=80] The width to use when the reported width is unusable
     * @return {number} A usable terminal width
     */
    terminalWidth(width, fallback = 80) {
      return Number.isInteger(width) && width > 0 ? width : fallback;
    },

    /**
     * Zip 2 arrays together, i.e. ([1, 2, 3], [a, b, c]) => [[1, a], [2, b], [3, c]]
     * @param {any[]} a
     * @param {any[]} b
     * @return {any[]}
     */
    zip: (a, b) => a.map((k, i) => [k, b[i]])
  }
})();
