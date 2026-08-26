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
    return config.initialised;
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
  async restoreTask(taskId, columnName) {
    config.output = {
      taskId,
      columnName
    };
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
  async moveTask(taskId, columnName, position = null, relative = false) {
    config.output = {
      taskId,
      columnName,
      position,
      relative
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
  async deleteTask(taskId, removeFile = false) {
    config.output = {
      taskId,
      removeFile
    };
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
