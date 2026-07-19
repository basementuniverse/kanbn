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

// Store mock settings and output
const config = {
  output: null,
  initialised: false,
  mainFolderName: 'test',
  index: TEST_INDEX,
  dateFormat: 'yyyy-mm-dd',
  task: TEST_TASK,
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
  }
};

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
  async gantt() {
    config.output = {
      gantt: true
    };
    return config.ganttData;
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
  }
};

module.exports = { config, kanbn };
