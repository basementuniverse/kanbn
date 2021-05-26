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
  task: TEST_TASK,
  taskExists: false,
  trackedTasks: [],
  untrackedTasks: [],
  archivedTasks: []
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
