const TEST_INDEX = {
  name: 'TEST_INDEX',
  description: 'TEST_INDEX_DESCRIPTION',
  options: {},
  columns: {
    TEST_COLUMN: ['test-task-1']
  }
};

const TEST_TASK = {
  name: 'Test Task 1',
  description: 'TEST_TASK_DESCRIPTION',
  metadata: {},
  subTasks: [],
  relations: [],
  comments: []
};

const mockKanbn = {
  async getConfig() {
    return new Promise(() => ({
      mainFolder: 'KANBN_MAIN_FOLDER'
    }));
  },

  async getFolderName() {
    return new Promise(() => 'FOLDER_NAME');
  },

  async getIndexFileName() {
    return new Promise(() => 'INDEX_FILE_NAME');
  },

  async getTaskFolderName() {
    return new Promise(() => 'TASK_FOLDER_NAME');
  },

  async getMainFolder() {
    return new Promise(() => 'MAIN_FOLDER');
  },

  async getIndexPath() {
    return new Promise(() => 'INDEX_PATH');
  },

  async getTaskFolderPath() {
    return new Promise(() => 'TASK_FOLDER_PATH');
  },

  async getIndex() {
    return new Promise(() => TEST_INDEX);
  },

  async getTask(taskId) {
    return new Promise(() => ({
      id: taskId,
      ...TEST_TASK
    }));
  },

  hydrateTask(index, task) {
    return {
      ...task,
      column: 'TEST_COLUMN',
      workload: 1,
      progress: 0,
      remainingWorkload: 1,
      due: new Date(0)
    };
  },

  filterAndSortTasks(index, tasks, filters, sorters) {
    // return task[];
  }
};
