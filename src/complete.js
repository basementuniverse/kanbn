/**
 * Shell completion: `kanbn __complete -- <words...>` prints the candidates for the last word, one per
 * line as `value<TAB>description`, followed by a directive line. See docs/completion.md for the wire
 * protocol and resources/specs/autocomplete.md for the design
 *
 * This runs on every Tab press, so it has a latency budget measured in milliseconds. It requires only
 * fs and path - nothing from the rest of src/, and in particular never ./main, which costs ~50ms to
 * load. yamljs is required lazily, and only when a config file or front matter actually has to be read.
 * test/unit/complete.test.js asserts both the budget and the fact that ./main stays unloaded
 *
 * It must also be silent: the user is mid-keystroke, so nothing goes to stderr, nothing is prompted
 * for or written, and the exit code is always 0. Anything that goes wrong produces no candidates
 */
const fs = require('fs');
const path = require('path');

// No file completion fallback. The only directive v1 uses - see docs/completion.md
const DIRECTIVE = ':4';

const DEFAULT_FOLDER_NAME = '.kanbn';
const DEFAULT_INDEX_FILE_NAME = 'index.md';
const DEFAULT_TASKS_FOLDER_NAME = 'tasks';
const DEFAULT_ARCHIVE_FOLDER_NAME = 'archive';

// Kept in step with src/main.js, which is the authority on how boards and options resolve
const MAIN_BOARD_ALIASES = ['main', 'default'];
const WORKSPACE_SCOPED_OPTIONS = [
  'mainFolder', 'indexFile', 'taskFolder', 'archiveFolder', 'defaultBoard', 'boards', 'customFields',
  'contributors', 'dateFormat', 'defaultTaskWorkload', 'taskWorkloadTags', 'taskIdResolution'
];
const WORKSPACE_INHERITED_OPTIONS = [...WORKSPACE_SCOPED_OPTIONS, 'sprints'];
const RESERVED_BOARDS_CONFIG_KEYS = ['exclude', 'order'];

// The same rules as src/parse-markdown.js: a heading starts at column 0 with exactly one space, and
// nothing inside a fenced code block is a heading
const HEADING = /^(#{1,6}) (.+)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// A top-level list item, and a task link at the start of one - the format contract lives in
// src/parse-index.js taskIdFromListItem(). test/unit/complete.test.js checks the two agree
const LIST_ITEM = /^ ?(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const TASK_LINK = /^\[([^\]]*)\]\(/;

/**
 * Compare two strings for sorting. Not localeCompare(), whose first call initialises ICU and costs
 * more than everything else a completion does put together
 * @param {string} a
 * @param {string} b
 * @return {number}
 */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Read a file, or return null if it can't be read
 * @param {string} file
 * @return {?string}
 */
function read(file) {
  try {
    return fs.readFileSync(file, { encoding: 'utf-8' });
  } catch (error) {
    return null;
  }
}

/**
 * List the markdown files in a folder, without their extension
 * @param {string} folder
 * @return {string[]}
 */
function markdownFiles(folder) {
  try {
    return fs.readdirSync(folder).filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).sort();
  } catch (error) {
    return [];
  }
}

/**
 * Parse YAML, or return an empty object if it isn't a YAML mapping
 * @param {string} source
 * @return {object}
 */
function parseYaml(source) {
  try {
    const result = require('yamljs').parse(source);
    return result !== null && typeof result === 'object' && !Array.isArray(result) ? result : {};
  } catch (error) {
    return {};
  }
}

/**
 * Split a markdown file into its front matter and body
 * @param {string} markdown
 * @return {{frontMatter: ?string, body: string}}
 */
function splitFrontMatter(markdown) {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  return match === null
    ? { frontMatter: null, body: markdown }
    : { frontMatter: match[1], body: markdown.slice(match[0].length) };
}

/**
 * Parse just enough of a board file to complete from it: the columns, in order, with the task ids
 * linked in each and the simple tasks (single-line list items that aren't task links)
 * @param {string} markdown The board file
 * @return {{frontMatter: ?string, options: function(): object, columns: object[]}} The raw front matter,
 * a function that parses it, and the columns as {name, tasks, simpleTasks}
 */
function parseBoard(markdown) {
  const { frontMatter, body } = splitFrontMatter(markdown);
  const columns = [];
  const byName = {};
  let name = null, column = null, fence = null;

  // The list item being read, until it's known whether it spans more than one line
  let item = null, blank = false;
  const endItem = () => {
    if (item !== null && column !== null && item.simple && item.text) {
      column.simpleTasks.push(item.text);
    }
    item = null;
  };

  for (const rawLine of body.trim().split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const fenceMatch = FENCE.exec(line);
    if (fence !== null) {
      if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length && !fenceMatch[2].trim()) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch && (fenceMatch[1][0] !== '`' || fenceMatch[2].indexOf('`') === -1)) {
      endItem();
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      endItem();
      const title = heading[2];
      if (name === null) {
        name = title;
        column = null;
      } else if (heading[1].length === 2 && title !== name && title !== 'Options') {

        // A repeated column heading carries on the same column, as parse-markdown merges them
        column = byName[title] || (byName[title] = { name: title, tasks: [], simpleTasks: [] });
        if (columns.indexOf(column) === -1) {
          columns.push(column);
        }
      } else {
        column = null;
      }
      continue;
    }
    if (column === null) {
      continue;
    }

    const listItem = LIST_ITEM.exec(line);
    if (listItem !== null) {
      endItem();
      const text = (listItem[1] || '').trim();
      const link = TASK_LINK.exec(text);
      if (link !== null) {
        column.tasks.push(link[1]);
      } else {

        // A task list item's checkbox isn't part of its text, as far as marked is concerned
        item = { text: text.replace(/^\[[ xX]\][ \t]+/, ''), simple: true };
      }
      blank = false;
      continue;
    }
    if (!line.trim()) {
      blank = true;
      continue;
    }

    // Anything else either continues the item above (indented, or a lazy continuation line), which
    // makes it more than one line long, or ends the list
    if (item !== null && (/^\s/.test(line) || !blank)) {
      item.simple = false;
    } else {
      endItem();
    }
    blank = false;
  }
  endItem();

  let options = null;
  return {
    frontMatter,
    options: () => options || (options = frontMatter === null ? {} : parseYaml(frontMatter)),
    columns
  };
}

/**
 * The workspace a completion runs in. Everything is read on first use and remembered, so a provider
 * that doesn't need the config file never reads it
 */
class Workspace {
  constructor(root, env) {
    this.root = root;
    this.env = env;
    this.memo = {};
  }

  remember(key, load) {
    if (!(key in this.memo)) {
      this.memo[key] = load();
    }
    return this.memo[key];
  }

  /** The config file's contents, or null if there isn't one */
  config() {
    return this.remember('config', () => {
      const yml = read(path.join(this.root, 'kanbn.yml'));
      if (yml !== null) {
        return parseYaml(yml);
      }
      const json = read(path.join(this.root, 'kanbn.json'));
      if (json !== null) {
        try {
          return JSON.parse(json) || {};
        } catch (error) {
          return {};
        }
      }
      return null;
    });
  }

  configValue(key, fallback) {
    const config = this.config();
    return config !== null && key in config ? config[key] : fallback;
  }

  mainFolder() {
    return path.join(this.root, this.configValue('mainFolder', DEFAULT_FOLDER_NAME));
  }

  indexFileName() {
    return this.configValue('indexFile', DEFAULT_INDEX_FILE_NAME);
  }

  mainBoardSlug() {
    return path.basename(this.indexFileName()).replace(/\.md$/, '');
  }

  taskFolder() {
    return path.join(this.mainFolder(), this.configValue('taskFolder', DEFAULT_TASKS_FOLDER_NAME));
  }

  archiveFolder() {
    return path.join(this.mainFolder(), this.configValue('archiveFolder', DEFAULT_ARCHIVE_FOLDER_NAME));
  }

  /** The workspace options: the config file if there is one, otherwise the main board's front matter */
  workspaceOptions() {
    return this.remember('workspaceOptions', () => {
      const config = this.config();
      if (config !== null) {
        return { options: config, fromConfig: true };
      }
      const main = this.board(this.mainBoardSlug());
      return { options: main === null ? {} : main.options(), fromConfig: false };
    });
  }

  /**
   * The declared custom fields - a workspace-scoped option
   * @return {object[]} Each field's name and type
   */
  customFields() {

    // Most workspaces have none, and a front matter that doesn't mention them isn't worth parsing
    if (this.config() === null) {
      const main = this.board(this.mainBoardSlug());
      if (main === null || main.frontMatter === null || !/^customFields:/m.test(main.frontMatter)) {
        return [];
      }
    }
    const fields = this.workspaceOptions().options.customFields;
    return Array.isArray(fields)
      ? fields.filter(field => field && typeof field.name === 'string' && field.name && typeof field.type === 'string')
      : [];
  }

  /**
   * Resolve a board slug the way the CLI does: the reserved aliases and an empty slug are the main board
   * @param {?string} slug
   * @return {string}
   */
  resolveSlug(slug) {
    slug = slug === null || slug === undefined ? '' : String(slug).trim();
    return slug === '' || MAIN_BOARD_ALIASES.indexOf(slug.toLowerCase()) !== -1 ? this.mainBoardSlug() : slug;
  }

  /**
   * The board a command targets: --board, then KANBN_BOARD, then the defaultBoard option, then main
   * @param {?string} boardArg The --board value on the command line, if any
   * @return {string} The resolved board slug
   */
  targetBoard(boardArg) {
    for (const slug of [boardArg, this.env.KANBN_BOARD]) {
      if (typeof slug === 'string' && slug.trim() !== '') {
        return this.resolveSlug(slug);
      }
    }
    return this.resolveSlug(this.defaultBoard());
  }

  /**
   * The defaultBoard option. Nearly every completion needs it, and it's a single top-level scalar, so
   * when it lives in front matter it's read directly rather than paying for a YAML parse
   * @return {?string}
   */
  defaultBoard() {
    let value;
    if (this.config() !== null) {
      value = this.config().defaultBoard;
    } else {
      const board = this.board(this.mainBoardSlug());
      const match = board === null || board.frontMatter === null
        ? null
        : /^defaultBoard:[ \t]*(.*?)[ \t]*$/m.exec(board.frontMatter);
      value = match === null ? null : unquote(match[1].replace(/[ \t]+#.*$/, ''));
    }
    return typeof value === 'string' ? value : null;
  }

  /**
   * Read and parse a board file
   * @param {string} slug A resolved board slug
   * @return {?object} The parsed board, or null if it doesn't exist
   */
  board(slug) {
    return this.remember(`board:${slug}`, () => {
      const file = slug === this.mainBoardSlug()
        ? path.join(this.mainFolder(), this.indexFileName())
        : path.join(this.mainFolder(), `${slug}.md`);
      const markdown = read(file);
      return markdown === null ? null : parseBoard(markdown);
    });
  }

  /**
   * A board's options, layered over the workspace's in the same way as Kanbn.resolveBoardOptions()
   * @param {string} slug A resolved board slug
   * @return {object}
   */
  boardOptions(slug) {
    const board = this.board(slug);
    const own = board === null ? {} : board.options();
    const { options, fromConfig } = this.workspaceOptions();
    if (slug === this.mainBoardSlug()) {
      return fromConfig ? { ...own, ...options } : own;
    }
    const inherited = fromConfig
      ? options
      : Object.fromEntries(Object.entries(options).filter(([key]) => WORKSPACE_INHERITED_OPTIONS.indexOf(key) !== -1));
    const boardsConfig = fromConfig && options.boards && typeof options.boards === 'object' ? options.boards : {};
    const boardConfig = RESERVED_BOARDS_CONFIG_KEYS.indexOf(slug) === -1 &&
      boardsConfig[slug] && typeof boardsConfig[slug] === 'object' && !Array.isArray(boardsConfig[slug])
      ? boardsConfig[slug]
      : {};
    const ownBoardOptions = Object.fromEntries(
      Object.entries(own).filter(([key]) => WORKSPACE_SCOPED_OPTIONS.indexOf(key) === -1)
    );
    return { ...inherited, ...boardConfig, ...ownBoardOptions };
  }

  /**
   * The front matter of every task file, for the providers that complete values stored in tasks.
   * A proper YAML parse of every file would blow the budget, and these values only feed suggestions,
   * so this is a deliberately rough read of the two shapes kanbn writes: `key: value` and a block list
   * @param {string} key The front matter key
   * @return {string[]} Every distinct value found
   */
  taskValues(key) {
    const values = new Set();
    const pattern = new RegExp(`^${key}:[ \\t]*(.*)$((?:\\r?\\n[ \\t]+-[ \\t]*.*)*)`, 'm');
    for (const taskId of markdownFiles(this.taskFolder())) {
      const markdown = read(path.join(this.taskFolder(), `${taskId}.md`));
      const frontMatter = markdown === null ? null : splitFrontMatter(markdown).frontMatter;
      const match = frontMatter === null ? null : pattern.exec(frontMatter);
      if (match === null) {
        continue;
      }
      const inline = match[1].trim();
      const items = inline.startsWith('[')
        ? inline.replace(/^\[|\]$/g, '').split(',')
        : inline ? [inline] : match[2].split('\n').map(line => line.replace(/^[ \t]*-[ \t]*/, ''));
      for (const value of items.map(unquote)) {
        if (value) {
          values.add(value);
        }
      }
    }
    return [...values].sort(compare);
  }
}

/**
 * Strip whitespace and a single layer of YAML quotes from a scalar
 * @param {string} value
 * @return {string}
 */
function unquote(value) {
  value = value.trim();
  return /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
}

/**
 * Load every route config. Read directly rather than through auto-load, which is the difference
 * between a few small JSON reads and loading a module loader
 * @return {object[]} Route configs, sorted by canonical command name
 */
function loadRoutes() {
  const folder = path.join(__dirname, '..', 'routes');
  return fs.readdirSync(folder)
    .filter(name => name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(folder, name), { encoding: 'utf-8' })))
    .sort((a, b) => compare(a.commands[0], b.commands[0]));
}

// Candidate providers. Each returns a list of [value, description] pairs
const PROVIDERS = {
  command: ({ routes }) => routes
    .filter(route => route.commands[0])
    .map(route => [route.commands[0], route.name]),

  task: ({ workspace, boardSlug }) => {
    const board = workspace.board(boardSlug);
    return board === null
      ? []
      : board.columns.flatMap(column => column.tasks.map(taskId => [taskId, column.name]));
  },

  // Editing a simple task is how it becomes a real one, so edit offers them too
  'task-or-simple-task': context => {
    const board = context.workspace.board(context.boardSlug);
    return board === null
      ? []
      : [
        ...PROVIDERS.task(context),
        ...board.columns.flatMap(column => column.simpleTasks.map(text => [text, `${column.name} (simple task)`]))
      ];
  },

  // Hidden columns are still real columns, so they're offered - last, and marked
  column: ({ workspace, boardSlug }) => {
    const board = workspace.board(boardSlug);
    if (board === null) {
      return [];
    }
    const hidden = workspace.boardOptions(boardSlug).hiddenColumns;
    const isHidden = column => Array.isArray(hidden) && hidden.indexOf(column.name) !== -1;
    return [
      ...board.columns.filter(column => !isHidden(column)).map(column => [column.name, `${column.tasks.length} ${column.tasks.length === 1 ? 'task' : 'tasks'}`]),
      ...board.columns.filter(isHidden).map(column => [column.name, 'hidden'])
    ];
  },

  // Moving a task to the column it's already in does nothing, so that one isn't offered
  'other-column': context => {
    const taskId = context.positionals[0];
    const board = context.workspace.board(context.boardSlug);
    const current = board === null || taskId === undefined
      ? undefined
      : board.columns.find(column => column.tasks.indexOf(taskId) !== -1);
    return PROVIDERS.column(context).filter(([name]) => current === undefined || name !== current.name);
  },

  board: ({ workspace }) => {
    const boards = workspace.configValue('boards', {});
    const exclude = boards && Array.isArray(boards.exclude)
      ? boards.exclude.map(slug => String(slug).replace(/\.md$/, ''))
      : [];
    return markdownFiles(workspace.mainFolder())
      .filter(slug => exclude.indexOf(slug) === -1)
      .map(slug => [slug, slug === workspace.mainBoardSlug() ? 'main board' : '']);
  },

  'archived-task': ({ workspace }) => markdownFiles(workspace.archiveFolder()).map(taskId => [taskId, 'archived']),

  tag: ({ workspace }) => workspace.taskValues('tags').map(tag => [tag, '']),

  // The declared contributors if there are any, because that's the only way to offer someone who has
  // no tasks yet. Otherwise whoever is assigned to something
  assigned: ({ workspace }) => {
    const contributors = workspace.workspaceOptions().options.contributors;
    const names = Array.isArray(contributors)
      ? contributors
        .map(contributor => typeof contributor === 'string' ? contributor : contributor && contributor.name)
        .filter(name => typeof name === 'string' && name.trim())
        .map(name => name.trim())
      : [];
    return [
      ...(names.length ? names : workspace.taskValues('assigned')).map(name => [name, '']),
      ['@me', 'the current user']
    ];
  },

  // Kept in step with src/controller/completion.js, which can't be required from here
  shell: () => [['bash', ''], ['fish', ''], ['zsh', '']],

  sprint: ({ workspace, boardSlug }) => {
    const sprints = workspace.boardOptions(boardSlug).sprints;
    return Array.isArray(sprints)
      ? sprints
        .map((sprint, i) => [sprint && sprint.name, `sprint ${i + 1}`])
        .filter(([name]) => typeof name === 'string' && name)
      : [];
  }
};

/**
 * Get the long option names a route accepts
 * @param {object} args The route's minimist config
 * @return {string[][]} [option, description] pairs
 */
function optionNames(args) {
  const defaults = args.default || {};
  const names = [];
  for (const name of args.boolean || []) {
    names.push([`--${name}`, '']);
    if (defaults[name] === true) {
      names.push([`--no-${name}`, '']);
    }
  }
  for (const name of args.string || []) {
    names.push([`--${name}`, '']);
  }
  return names.sort((a, b) => compare(a[0], b[0]));
}

/**
 * Map an option as typed (`--column`, `-c`) to its canonical name, using the route's aliases
 * @param {object} args The route's minimist config
 * @param {string} name The option name without its dashes
 * @return {string}
 */
function canonicalOption(args, name) {
  for (const [canonical, aliases] of Object.entries(args.alias || {})) {
    if ([].concat(aliases).indexOf(name) !== -1) {
      return canonical;
    }
  }
  return name;
}

/**
 * Work through the words before the cursor, finding positional arguments, option values and any
 * --board, the same way minimist will read them. That includes minimist's rule that any option not
 * declared as a boolean takes the next word as its value - which is how custom fields, which no route
 * declares, get theirs - unless that word looks like an option itself
 * @param {object} args The route's minimist config
 * @param {string[]} words The words after the command and before the current word
 * @return {{positionals: string[], board: ?string, pending: ?string}} The positional arguments seen,
 * the --board value, and the option still waiting for its value, if the last word was one
 */
function scanWords(args, words) {
  const booleans = args.boolean || [];
  const positionals = [];
  let board = null, pending = null, rest = false;
  for (const word of words) {
    if (rest) {
      positionals.push(word);
      continue;
    }
    const isOption = /^--?[^-]/.test(word);
    if (pending !== null) {
      const name = pending;
      pending = null;
      if (!isOption) {
        if (name === 'board') {
          board = word;
        }
        continue;
      }
    }
    if (word === '--') {
      rest = true;
      continue;
    }
    const long = /^--([^=]+)(?:=([\s\S]*))?$/.exec(word);
    const short = /^-([^-].*)$/.exec(word);
    if (long !== null) {
      const name = canonicalOption(args, long[1]);
      if (long[2] !== undefined) {
        if (name === 'board') {
          board = long[2];
        }
      } else if (!name.startsWith('no-') && booleans.indexOf(name) === -1) {
        pending = name;
      }
      continue;
    }
    if (short !== null) {

      // In a run of short flags (-iz) only the last one can take a value
      const name = canonicalOption(args, short[1].slice(-1));
      if (booleans.indexOf(name) === -1) {
        pending = name;
      }
      continue;
    }
    positionals.push(word);
  }
  return { positionals, board, pending };
}

/**
 * Get the options a route accepts for each custom field. Which ones depends on the command: setting a
 * boolean field to false is --no-<field>, edit can also --remove-<field>, and sort just takes the name
 * @param {object} workspace
 * @param {object} config The route's customFields completion config
 * @return {string[][]} [option, description] pairs
 */
function customFieldOptions(workspace, config) {
  const names = [];
  for (const field of workspace.customFields()) {
    names.push([`--${field.name}`, `custom field (${field.type})`]);
    if (config.negate && field.type === 'boolean') {
      names.push([`--no-${field.name}`, 'custom field (boolean)']);
    }
    if (config.remove) {
      names.push([`--remove-${field.name}`, 'custom field']);
    }
  }
  return names;
}

/**
 * Work out the candidates for the last word of a partial command line
 * @param {string[]} words The command line, starting with "kanbn"; the last word is the one being
 * completed, and may be empty
 * @param {object} [options]
 * @param {string} [options.cwd=process.cwd()] The workspace root
 * @param {object} [options.env=process.env] The environment, for KANBN_BOARD
 * @return {string[][]} [value, description] pairs
 */
function complete(words, { cwd = process.cwd(), env = process.env } = {}) {
  if (words.length < 2) {
    return [];
  }
  const routes = loadRoutes();
  let current = words[words.length - 1];
  let before = words.slice(2, -1);

  // What gets put back in front of each candidate, when the word being completed isn't all value
  let prefix = '';

  let candidates = [];
  if (words.length === 2) {
    candidates = PROVIDERS.command({ routes });
  } else {
    const route = routes.find(route => route.commands.indexOf(words[1]) !== -1);
    if (route === undefined) {
      return [];
    }
    const args = route.args || {};
    const completions = route.completions || {};

    // --column=value arrives as one word from zsh and fish. bash splits it at the = into separate
    // words, so put those back together, remembering that bash will replace only the last of them
    let option = null;
    const joined = /^(--[^=]+=)(.*)$/.exec(current);
    if (joined !== null) {
      [, prefix, current] = joined;
      option = prefix.slice(2, -1);
    } else if (current === '=' && /^--./.test(before[before.length - 1] || '')) {
      option = before.pop().slice(2);
      prefix = '=';
      current = '';
    } else if (before.length >= 2 && before[before.length - 1] === '=' && /^--./.test(before[before.length - 2])) {
      option = before.splice(-2)[0].slice(2);
    }

    const scan = scanWords(args, before);
    const workspace = new Workspace(cwd, env);
    const context = () => ({
      routes,
      workspace,
      boardSlug: workspace.targetBoard(scan.board),
      positionals: scan.positionals
    });
    if (option === null && current.startsWith('-')) {
      candidates = optionNames(args);
      if (completions.customFields) {
        candidates = [...candidates, ...customFieldOptions(workspace, completions.customFields)];
      }
    } else if (option !== null || scan.pending !== null) {
      const name = option !== null ? canonicalOption(args, option) : scan.pending;
      const provider = (completions.options || {})[name];
      if (provider && PROVIDERS[provider]) {
        candidates = PROVIDERS[provider](context());
      } else if (completions.customFields && completions.customFields.values) {

        // A string custom field's values come from the tasks, the same way tags do
        const field = workspace.customFields().find(field => field.name === name);
        if (field !== undefined && field.type === 'string') {
          candidates = workspace.taskValues(field.name).map(value => [value, '']);
        }
      }
    } else {
      const provider = (completions.positional || [])[scan.positionals.length];
      if (provider && PROVIDERS[provider]) {
        candidates = PROVIDERS[provider](context());
      }
    }
  }

  // Values can't contain a line break or a tab, because those delimit the output
  const seen = new Set();
  return candidates
    .filter(([value]) => typeof value === 'string' && value !== '' && !/[\t\r\n]/.test(value))
    .filter(([value]) => value.startsWith(current))
    .filter(([value]) => !seen.has(value) && seen.add(value))
    .map(([value, description]) => [prefix + value, String(description || '').replace(/[\t\r\n]+/g, ' ')]);
}

/**
 * Print the candidates for a partial command line. Never throws, never writes to stderr
 * @param {string[]} argv Everything after `__complete` on the command line
 */
module.exports = argv => {
  let lines = [];
  try {
    const words = argv[0] === '--' ? argv.slice(1) : argv;
    lines = complete(words).map(([value, description]) => description ? `${value}\t${description}` : value);
  } catch (error) {
    lines = [];
  }
  process.stdout.write([...lines, DIRECTIVE].join('\n') + '\n');
};

module.exports.complete = complete;
module.exports.parseBoard = parseBoard;
