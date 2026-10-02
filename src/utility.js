const fuzzy = require('fuzzy');

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
     * Resolve the board a command targets and return a Kanbn instance scoped to it, printing an
     * error and returning null if the workspace or the board doesn't exist
     * @param {object} workspace The workspace-scoped Kanbn instance
     * @param {object} args The parsed command arguments
     * @return {Promise<object|null>} A board-scoped Kanbn instance, or null if it can't be resolved
     */
    async resolveBoard(workspace, args) {

      // Sprint numbers and names are relative to one board's list, so an aggregate across boards
      // can't resolve them. Refuse rather than guess
      if (args['all-boards'] && args.sprint) {
        this.error(
          '{b}--sprint{b} and {b}--all-boards{b} cannot be used together, because sprint numbers ' +
          'and names are relative to a single board'
        );
        return null;
      }
      const kanbn = await workspace.boardFromArgs(args);

      // Actions are declarative rules with no code execution, so this is a way around a misbehaving
      // rule rather than a safety control
      if (args.actions === false || args['no-actions'] === true) {
        kanbn.actionsEnabled = false;
      }
      if (!await kanbn.workspaceInitialised()) {
        this.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
        return null;
      }
      if (!await kanbn.initialised()) {
        this.error(
          `Board "${await kanbn.resolveBoardSlug()}" doesn't exist\n` +
          'Try running: {b}kanbn boards{b}'
        );
        return null;
      }
      return kanbn;
    },

    /**
     * Resolve the boards a command targets, along with the column to use on each. `-b` is repeatable
     * and pairs positionally with `-c`: board i uses the i-th `-c` if there is one, otherwise the
     * first `-c`, otherwise that board's first column (Q5). Prints an error and returns null if any
     * board can't be resolved
     * @param {object} workspace The workspace-scoped Kanbn instance
     * @param {object} args The parsed command arguments
     * @return {Promise<object[]|null>} One entry per target board, or null on error
     */
    async resolveBoardTargets(workspace, args) {
      const boardArgs = args.board === undefined
        ? []
        : this.arrayArg(args.board).filter(slug => slug !== undefined && slug !== '');
      const columnArgs = args.column === undefined ? [] : this.arrayArg(args.column);
      const slugs = boardArgs.length ? boardArgs : [await workspace.resolveTargetBoard(null)];

      // With a single target board an unknown column is an error, exactly as it has always been.
      // Falling back only makes sense when several boards are targeted at once, where a column can
      // legitimately exist on one and not another
      const allowFallback = slugs.length > 1;

      const targets = [];
      for (let i = 0; i < slugs.length; i++) {
        const kanbn = await this.resolveBoard(workspace, { board: slugs[i], actions: args.actions });
        if (kanbn === null) {
          return null;
        }
        let index;
        try {
          index = await kanbn.getIndex();
        } catch (error) {
          this.error(error);
          return null;
        }
        const columnNames = Object.keys(index.columns);
        if (!columnNames.length) {
          this.error('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}');
          return null;
        }

        const requestedColumn = columnArgs.length
          ? (columnArgs[i] !== undefined ? columnArgs[i] : columnArgs[0])
          : null;
        let columnName = requestedColumn === null ? columnNames[0] : requestedColumn;
        let fallback = false;
        if (!(columnName in index.columns)) {
          if (!allowFallback) {
            this.error(`Column "${columnName}" doesn't exist`);
            return null;
          }
          columnName = columnNames[0];
          fallback = true;
        }
        targets.push({
          kanbn,
          index,
          slug: await kanbn.resolveBoardSlug(),
          columnName,
          requestedColumn,
          fallback
        });
      }
      return targets;
    },

    /**
     * Tell the user when a target board didn't have the column that was asked for, so that a task
     * quietly landing somewhere else is never a surprise
     * @param {object[]} targets Targets from resolveBoardTargets()
     * @param {boolean} show False to suppress the notice
     */
    showColumnFallbackNotices(targets, show = true) {
      if (!show) {
        return;
      }
      for (const target of targets.filter(t => t.fallback)) {
        console.log(this.replaceTags(
          `{d}Board "${target.slug}" has no column "${target.requestedColumn}" - using "${target.columnName}"{d}`
        ));
      }
    },

    /**
     * Show a hint about how many boards this workspace has, so that a command showing one board
     * doesn't look like it's showing everything. Suppressed for machine-readable output and when the
     * board sets verbose to false
     * @param {object[]} boards The list of boards
     * @param {boolean} show False to suppress the hint
     */
    showBoardCountHint(boards, show = true) {
      if (!show || boards.length < 2) {
        return;
      }
      console.log(this.replaceTags(`\n{d}${boards.length} boards available -{d} {b}kanbn boards{b}`));
    },

    /**
     * Resolve a string to exactly one simple task on a board, for the commands that accept one.
     * Real tasks always win, so this should only be called once no task has matched
     * @param {object} kanbn The board-scoped Kanbn instance
     * @param {string} input The title to match
     * @param {Error|string} taskError The error to report if nothing matches, i.e. the error the
     * command would have printed before simple tasks existed
     * @param {?object[]} [matches=null] Matches already found, to save looking them up again
     * @return {Promise<?object>} The matching simple task, or null if the error has been reported
     */
    async resolveSimpleTask(kanbn, input, taskError, matches = null) {
      if (matches === null) {
        try {
          matches = await kanbn.findSimpleTasks(input);
        } catch (error) {
          this.error(error);
          return null;
        }
      }
      if (!matches.length) {
        this.error(taskError);
        return null;
      }

      // Two lines with the same title are two different lines. Picking one of them silently would
      // eventually move or delete the wrong one
      if (matches.length > 1) {
        this.error(
          `"${input}" matches ${matches.length} simple tasks:\n` +
          matches.map(match => `  "${match.text}" in column "${match.column}"`).join('\n') +
          '\nEdit the board file directly, or rename one of them'
        );
        return null;
      }
      return matches[0];
    },

    /**
     * Get the task id a command was given, resolving a partial id to a full one where it's unambiguous
     *
     * Prints an error and returns null if there's no id, or if the id is ambiguous. An id that doesn't
     * resolve to anything is returned unchanged, so the command reports it exactly as it always has.
     * A simple task whose title matches the input exactly is left for the command to handle, rather
     * than being shadowed by a task whose id merely starts with it
     * @param {object} kanbn The board-scoped Kanbn instance
     * @param {object} args The parsed command arguments
     * @param {string} command The command name, for the "no task id" hint
     * @param {object} [options]
     * @param {?string} [options.confirm=null] For a destructive command, the verb to ask for
     * confirmation with ("Archive") when the id was only partially matched. --force skips the prompt,
     * and without a terminal to prompt on the command fails rather than guessing
     * @param {boolean} [options.interactiveIfPicked=false] Switch the command to its interactive mode
     * if the task was picked from a list, because nothing else was given on the command line either
     * @return {Promise<?string>} The task id, or null if an error was printed or the user declined
     */
    async resolveTaskArg(kanbn, args, command, { confirm = null, interactiveIfPicked = false } = {}) {
      const input = args._[1];
      if (!input) {
        const picked = this.canPrompt(args) ? await this.pickTask(kanbn) : null;
        if (picked === null) {
          this.error(`No task id specified\nTry running {b}kanbn ${command} "task id"{b}`);
          return null;
        }
        if (interactiveIfPicked) {
          args.interactive = true;
        }
        return picked;
      }
      let resolved;
      try {
        resolved = await kanbn.resolveTaskId(input);
      } catch (error) {
        this.error(error);
        return null;
      }
      if (resolved.match === null || resolved.match === 'exact' || resolved.match === 'file') {
        return resolved.id;
      }
      if ((await kanbn.findSimpleTasks(input)).length) {
        return input;
      }

      // Say what the input was taken to mean. A tool that silently reinterprets its arguments feels
      // unreliable even when it's right
      console.error(this.replaceTags(`{d}Resolved "${input}" to "${resolved.id}"{d}`));
      if (confirm === null || args.force) {
        return resolved.id;
      }
      if (!this.canPrompt(args)) {
        this.error(
          `"${input}" isn't an exact task id\n` +
          `Use the full id {b}${resolved.id}{b}, or {b}--force{b} to ${confirm.toLowerCase()} it anyway`
        );
        return null;
      }
      const answers = await require('inquirer').prompt([
        {
          type: 'confirm',
          message: `${confirm} task "${resolved.id}"?`,
          name: 'sure',
          default: false
        }
      ]);
      return answers.sure ? resolved.id : null;
    },

    /**
     * Check whether a command can stop and ask the user something it wasn't told on the command line.
     * A prompt with nobody to answer it hangs a script forever, so this needs a terminal at both ends
     * and no sign that the output is going to a program
     * @param {object} args The parsed command arguments
     * @return {boolean} True if it's safe to prompt
     */
    canPrompt(args) {
      return !!process.stdin.isTTY &&
        !!process.stdout.isTTY &&
        !args.quiet &&
        !args.json &&
        !process.env.KANBN_NO_INTERACTIVE;
    },

    /**
     * Ask the user to pick one of the board's tasks from a filterable list
     * @param {object} kanbn The board-scoped Kanbn instance
     * @return {Promise<?string>} The picked task id, or null if the board has no tasks
     */
    async pickTask(kanbn) {
      let index;
      try {
        index = await kanbn.getIndex();
      } catch (error) {
        return null;
      }

      // Hidden columns' tasks are still real tasks that every command operates on, so they're listed
      const tasks = Object.entries(index.columns)
        .flatMap(([column, taskIds]) => taskIds.map(id => ({ id, column })));
      if (!tasks.length) {
        return null;
      }
      const width = Math.max(...tasks.map(task => task.id.length));
      const choices = tasks.map(task => ({
        name: `${task.id.padEnd(width)}  ${this.dim(task.column)}`,
        value: task.id,
        short: task.id
      }));

      const inquirer = require('inquirer');
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
      const answers = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'taskId',
          message: 'Which task?',
          source: (answers, input) => Promise.resolve(
            fuzzy.filter(input || '', choices, { extract: choice => choice.value })
              .map(result => result.original)
          )
        }
      ]);
      return answers.taskId;
    },

    /**
     * Report rules that were skipped during an operation
     *
     * A rule that quietly stops working is worse than no rule, so these go to stderr and aren't
     * suppressed by verbose - the operation itself succeeded, which is why they aren't errors
     * @param {object} kanbn The board-scoped Kanbn instance the operation ran on
     */
    showActionWarnings(kanbn) {
      const warnings = (kanbn && kanbn.lastActionWarnings) || [];
      if (!warnings.length) {
        return;
      }
      for (const warning of warnings) {
        console.error(this.replaceTags(`{d}action:{d} ${warning}`));
      }
    },

    /**
     * Show a hint about tasks that a board references but which have no task file. These are skipped
     * rather than fatal, so the hint is the only sign that the board is showing less than it lists
     * @param {object[]} missing Missing task entries from kanbn.findMissingTaskFiles()
     * @param {boolean} show False to suppress the hint
     */
    showMissingTaskFilesHint(missing, show = true) {
      if (!show || !missing.length) {
        return;
      }
      const summary =
        `${missing.length} ${missing.length === 1 ? 'task has' : 'tasks have'} no task file and ` +
        `${missing.length === 1 ? 'was' : 'were'} skipped`;
      console.log(this.replaceTags(`\n{d}${summary} - run{d} {b}kanbn validate{b} {d}for details{d}`));
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
     * Build the prompt definition for a task's assigned user
     *
     * With contributors configured this is an autocomplete over the list, which is where the typo
     * mitigation comes from; without them it's the free-text input it has always been. Free text is
     * accepted either way - contributors are advisory, never an enum, so a name that isn't in the
     * list is still a perfectly good answer
     * @param {object} options The prompt properties to merge in, i.e. name, message, default, when
     * @param {object[]} contributors The workspace's normalised contributors
     * @return {object} A prompt definition
     */
    assignedPrompt(options, contributors) {
      if (!contributors.length) {
        return { type: 'input', ...options };
      }

      // Suggestions are the canonical names, because that's the value written into the task file
      const names = contributors.map(contributor => contributor.name);
      return {
        type: 'autocomplete',
        suggestOnly: true,
        source: (answers, input) => Promise.resolve(
          fuzzy.filter(input || '', names).map(result => result.string)
        ),
        ...options
      };
    },

    /**
     * Expand "@me" in a filter value to the current user
     *
     * The substitution is kept here, at the argument-parsing boundary: "@me" means something when
     * filtering and nothing at all when setting a value, and a literal "@me" in a task file is
     * nonsense nobody needs supported
     * @param {object} kanbn The board-scoped Kanbn instance
     * @param {string|string[]} value The filter value from the arguments
     * @return {Promise<string|string[]|null>} The expanded value, or null if "@me" can't be resolved
     */
    async expandCurrentUser(kanbn, value) {
      const isMe = v => typeof v === 'string' && v.trim() === '@me';
      const values = this.arrayArg(value);
      if (!values.some(isMe)) {
        return value;
      }
      const currentUser = await kanbn.currentUser();
      if (!currentUser) {
        this.error(
          "Unable to work out who you are, so {b}@me{b} can't be resolved\n" +
          'Set {b}KANBN_USER{b}, or set a git username with {b}git config user.name "your name"{b}'
        );
        return null;
      }
      const expanded = values.map(v => (isMe(v) ? currentUser : v));
      return Array.isArray(value) ? expanded : expanded[0];
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
