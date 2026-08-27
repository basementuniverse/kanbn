// Required before mock-require swaps out src/main, so the pure helpers below can delegate to the
// real implementations instead of reimplementing index/task transformations
const realKanbn = require('../src/main');

const TEST_INDEX = {
  name: 'Test Project',
  description: 'Test description',
  columns: {
    'Test Column': [
      'test-task-1'
    ]
  },
  options: {}
};

const TEST_TASK = {
  name: 'Test Task 1',
  description: 'Task ',
  metadata: {},
  subTasks: [],
  relations: [],
  comments: []
};

// Default mock settings, copied into config before each test module so that settings changed by
// one module don't leak into the next
function defaults() {
  return {
    output: null,
    initialised: false,
    mainFolderName: 'test',
    index: JSON.parse(JSON.stringify(TEST_INDEX)),
    dateFormat: 'yyyy-mm-dd',
    task: JSON.parse(JSON.stringify(TEST_TASK)),
    taskExists: false,
    trackedTasks: [],
    untrackedTasks: [],
    archivedTasks: [],
    burndownData: {
      series: []
    },
    ganttData: {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-02T00:00:00.000Z'),
      tasks: []
    },
    historyData: {
      periods: [],
      events: []
    },
    taskColumn: 'Test Column',
    boards: [
      { slug: 'index', path: 'test/index.md', name: 'Test Project', description: '', main: true }
    ],
    taskBoards: {},
    crossBoardTasks: [],
    orphanedTasks: [],
    restoreWarnings: [],
    boardWarnings: [],
    boardSlug: null,
    searchResults: [],
    statusData: {},
    validateResult: true,
    dateDrift: [],
    fixedDateDrift: [],
    sprintData: {
      name: 'Test Sprint',
      start: new Date('2026-01-01T00:00:00.000Z')
    },

    // Set to an error message to make the named library method reject, so that a controller's
    // error handling can be tested
    errors: {}
  };
}

// Store mock settings and output
const config = defaults();

/**
 * Restore every mock setting to its default
 */
config.reset = () => Object.assign(config, defaults());

/**
 * Throw if the test has configured the named method to fail
 * @param {string} method The method name
 */
function failIfConfigured(method) {
  if (config.errors[method]) {
    throw new Error(config.errors[method]);
  }
}

// Mock kanbn library
const kanbn = {
  async initialised() {

    // A board-scoped instance reports whether that board exists, so that a controller given a
    // --board that isn't there takes the "board doesn't exist" path
    if (config.boardSlug && !config.boards.some(board => board.slug === config.boardSlug)) {
      return false;
    }
    return config.initialised;
  },
  async workspaceInitialised() {
    return config.initialised;
  },

  // Board scoping - board() records which board was asked for and hands back the same mock, so that
  // controllers can be driven with --board without the mock needing a second instance
  board(slug = null) {
    config.boardSlug = slug;
    return kanbn;
  },
  withBoard(slug = null) {
    return kanbn.board(slug);
  },
  async isMainBoard(slug = undefined) {
    return (await kanbn.resolveBoardSlug(slug)) === 'index';
  },
  async addTaskToBoard(taskId, columnName) {
    config.output = {
      untrackedTask: taskId,
      columnName
    };
    return taskId;
  },
  async resolveBoardSlug(slug = undefined) {
    if (slug === undefined) {
      slug = config.boardSlug;
    }
    return slug === null || slug === undefined || slug === '' ? 'index' : slug;
  },
  async resolveTargetBoard(slug = null) {
    if (slug !== null && slug !== undefined && String(slug).trim() !== '') {
      return String(slug).trim();
    }
    if (process.env.KANBN_BOARD) {
      return process.env.KANBN_BOARD;
    }
    return null;
  },
  async boardFromArgs(args = {}) {
    const argBoard = Array.isArray(args.board) ? args.board[args.board.length - 1] : args.board;
    return kanbn.board(await kanbn.resolveTargetBoard(argBoard || null));
  },
  async listBoards() {
    return config.boards;
  },
  async getBoardsSummary() {
    return config.boards.map(board => ({
      columns: 0,
      tasks: 0,
      completed: 0,
      completedPercentage: 0,
      modified: null,
      ...board
    }));
  },
  async getCrossBoardTasks(allTasks = false) {
    config.output = { crossBoardTasks: true, allTasks };
    return config.crossBoardTasks;
  },
  async findTaskBoards(taskId) {
    return config.taskBoards;
  },
  async getTaskBoardColumns(taskId) {
    return config.taskBoards;
  },
  async boardExists(slug) {
    return config.boards.some(board => board.slug === slug);
  },
  async createBoard(slug, options = {}) {
    config.output = { createBoard: slug, options };
    return slug;
  },
  async deleteBoard(slug) {
    config.output = { deleteBoard: slug };
    failIfConfigured('deleteBoard');
    return config.orphanedTasks || [];
  },
  async renameBoard(slug, newSlug, newName = null) {
    config.output = { renameBoard: slug, newSlug, newName };
    failIfConfigured('renameBoard');
    return newSlug;
  },
  async findOrphanedTasks(slug) {
    failIfConfigured('findOrphanedTasks');
    return config.orphanedTasks || [];
  },
  async validateBoardSlug(slug) {
    failIfConfigured('validateBoardSlug');
    return slug;
  },
  async getMainFolder() {
    return config.mainFolderName;
  },
  async initialise(options = {}) {
    config.output = options;
  },
  async getIndex() {
    return config.index;
  },
  getDateFormat() {
    return config.dateFormat;
  },
  async burndown(sprints, dates, assigned, columns, normalise) {
    config.output = {
      sprints,
      dates,
      assigned,
      columns,
      normalise
    };
    return config.burndownData;
  },
  async gantt(assigned, columns, dates, now) {
    config.output = {
      gantt: true,
      assigned,
      columns,
      dates,
      now
    };
    return config.ganttData;
  },
  async history(sprints, dates, assigned, taskIds) {
    config.output = {
      history: true,
      sprints,
      dates,
      assigned,
      taskIds
    };
    return config.historyData;
  },
  async findTrackedTasks() {
    return config.trackedTasks;
  },
  async findUntrackedTasks() {
    return config.untrackedTasks;
  },
  async taskFileExists(taskId) {
    return config.taskExists;
  },
  async taskExists(taskId) {
    if (!config.taskExists) {
      throw new Error(`No task file found with id "${taskId}"`);
    }
  },
  async createTask(taskData, columnName) {
    config.output = {
      taskData,
      columnName
    };
  },
  async addUntrackedTaskToIndex(untrackedTask, columnName) {
    config.output = {
      untrackedTask,
      columnName
    };
  },
  async listArchivedTasks() {
    return config.archivedTasks;
  },
  async archiveTask(taskId) {
    config.output = {
      taskId
    };
    return taskId;
  },
  async restoreTask(taskId, columnName, singleBoard = false) {
    config.output = {
      taskId,
      columnName,
      singleBoard
    };
    kanbn.lastRestoreWarnings = config.restoreWarnings;
    return taskId;
  },
  async getTask(taskId) {
    if (!config.taskExists) {
      throw new Error(`No task file found with id "${taskId}"`);
    }
    return { id: taskId, ...config.task };
  },
  async findTaskColumn(taskId) {
    return config.taskColumn;
  },
  async loadAllTrackedTasks(index, columnName = null) {
    return config.trackedTasks;
  },
  async moveTask(taskId, columnName, position = null, relative = false, add = false) {
    config.output = {
      taskId,
      columnName,
      position,
      relative,
      add
    };
    return taskId;
  },
  async renameTask(taskId, newTaskName) {
    config.output = {
      taskId,
      newTaskName
    };
    return newTaskName.toLowerCase().replace(/\s+/g, '-');
  },
  async updateTask(taskId, taskData, columnName = null, unsetFields = []) {
    config.output = {
      taskId,
      taskData,
      columnName,
      unsetFields
    };
    return taskId;
  },
  async deleteTask(taskId, removeFile = false, allBoards = false) {
    config.output = {
      taskId,
      removeFile,
      allBoards
    };
    failIfConfigured('deleteTask');
    return taskId;
  },
  async removeAll() {
    config.output = { removeAll: true };
  },
  async comment(taskId, text, author) {
    config.output = {
      taskId,
      text,
      author
    };
    return taskId;
  },
  async search(filters = {}, quiet = false) {
    config.output = {
      filters,
      quiet
    };
    return config.searchResults;
  },
  async status(quiet, untracked, due, sprint, dates) {
    config.output = {
      quiet,
      untracked,
      due,
      sprint,
      dates
    };
    return config.statusData;
  },
  async sort(columnName, sorters, save = false) {
    config.output = {
      columnName,
      sorters,
      save
    };
  },
  async sprint(name, description, start) {
    config.output = {
      name,
      description,
      start
    };
    return config.sprintData;
  },
  async validate(save = false) {
    config.output = { save };
    failIfConfigured('validate');
    return config.validateResult;
  },
  async validateAllBoards(save = false) {
    config.output = { save, allBoards: true };
    failIfConfigured('validate');
    return config.validateResult;
  },
  async findBoardWarnings() {
    failIfConfigured('findBoardWarnings');
    return config.boardWarnings;
  },
  async searchAllBoards(filters = {}, quiet = false) {
    config.output = {
      filters,
      quiet,
      allBoards: true
    };
    return config.searchResults;
  },
  async findDateDrift() {
    failIfConfigured('findDateDrift');
    return config.dateDrift;
  },
  getDateDrift(index, tasks) {
    return config.dateDrift;
  },
  async fixDateDrift() {
    config.output = { fix: true };
    failIfConfigured('fixDateDrift');
    return config.fixedDateDrift;
  },

  // Pure helpers - these only transform the index and tasks they're given, so the real
  // implementations are used rather than mocked
  hydrateTask: (...args) => realKanbn.hydrateTask(...args),
  filterAndSortTasks: (...args) => realKanbn.filterAndSortTasks(...args),
  getTaskTemplate: (...args) => realKanbn.getTaskTemplate(...args),
  isVerbose: (...args) => realKanbn.isVerbose(...args)
};

// Controllers reach for the class (`new kanbn_module.Kanbn()`) as well as the singleton, so expose a
// constructor that hands back the same mock instance
function Kanbn() {
  return kanbn;
}
kanbn.Kanbn = Kanbn;

module.exports = { config, kanbn };
