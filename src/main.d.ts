/// <reference types="typescript" />

declare type index = {
  name: string,
  description: string,
  options: Record<string, any>,
  columns: Record<string, string[]>
};

declare type subTask = {
  text: string,
  completed: boolean
};

declare type relation = {
  task: string,
  type: string
};

declare type comment = {
  text: string,
  author: string,
  date: Date
};

declare type task = {
  id: string,
  name: string,
  description: string,
  metadata: Record<string, any>,
  subTasks: subTask[],
  relations: relation[],
  comments: comment[],
  column?: string,
  workload?: number,
  progress?: number,
  remainingWorkload?: number,
  due?: Record<string, any>
};

declare type status = {
  tasks: number,
  columnTasks: Record<string, number>
};

declare type sprint = {
  start: Date,
  name: string,
  description?: string
};

/**
 * Get the kanbn folder location for the current working directory
 * @return {string} The kanbn folder path
 */
export function getMainFolder(): string;

/**
 * Get the index as an object
 * @return {Promise<index>} The index
 */
export function getIndex(): Promise<index>;

/**
 * Get a task as an object
 * @param {string} taskId The task id to get
 * @return {Promise<task>} The task
 */
export function getTask(taskId: string): Promise<task>;

/**
 * Add additional index-based information to a task
 * @param {index} index The index object
 * @param {task} task The task object
 * @return {task} The hydrated task
 */
export function hydrateTask(index: index, task: task): task;

/**
 * Return a filtered and sorted list of tasks
 * @param {index} index
 * @param {task[]} tasks
 * @param {object} filters
 * @param {object[]} sorters
 * @return {task[]}
 */
export function filterAndSortTasks(index: index, tasks: task[], filters: object, sorters: object[]): task[];

/**
 * Overwrite the index file with the specified data
 * @param {object} indexData
 * @return {Promise<void>}
 */
export function saveIndex(indexData: object): Promise<void>;

/**
 * Load the index file and parse it to an object
 * @return {Promise<index>}
 */
export function loadIndex(): Promise<index>;

/**
 * Overwrite a task file with the specified data
 * @param {string} path
 * @param {Promise<void>} taskData
 */
export function saveTask(path: string, taskData: object): Promise<void>;

/**
 * Load a task file and parse it to an object
 * @param {Promise<void>} taskId
 * @return {Promise<task>}
 */
export function loadTask(taskId: string): Promise<task>;

/**
 * Load all tracked tasks and return an array of task objects
 * @param {index} index The index object
 * @param {?string} [columnName=null] The optional column name to filter tasks by
 * @return {Promise<task[]>} All tracked tasks
 */
export function loadAllTrackedTasks(index: index, columnName?: string|null): Promise<task[]>;

/**
 * Get the date format defined in the index, or the default date format
 * @param {index} index
 * @return {string}
 */
export function getDateFormat(index: index): string;

/**
 * Get the task template for displaying tasks on the kanbn board from the index, or the default task template
 * @param {index} index
 * @return {string}
 */
export function getTaskTemplate(index: index): string;

/**
 * Check if the current working directory has been initialised
 * @return {Promise<boolean>} True if the current working directory has been initialised, otherwise false
 */
export function initialised(): Promise<boolean>;

/**
 * Initialise a kanbn board in the current working directory
 * @param {object} [options={}] Initial columns and other config options
 * @return {Promise<void>}
 */
export function initialise(options?: object): Promise<void>;

/**
 * Check if a task file exists and is in the index, otherwise throw an error
 * @param {string} taskId The task id to check
 * @return {Promise<void>}
 */
export function taskExists(taskId: string): Promise<void>;

/**
 * Get the column that a task is in or throw an error if the task doesn't exist or isn't indexed
 * @param {string} taskId The task id to find
 * @return {Promise<string>} The name of the column the task is in
 */
export function findTaskColumn(taskId: string): Promise<string>;

/**
 * Create a task file and add the task to the index
 * @param {object} taskData The task object
 * @param {string} columnName The name of the column to add the task to
 * @return {Promise<string>} The id of the task that was created
 */
export function createTask(taskData: object, columnName: string): Promise<string>;

/**
 * Add an untracked task to the specified column in the index
 * @param {string} taskId
 * @param {string} columnName
 * @return {Promise<string>} The id of the task that was added
 */
export function addUntrackedTaskToIndex(taskId: string, columnName: string): Promise<string>;

/**
 * Get a list of tracked tasks (i.e. tasks that are listed in the index)
 * @param {?string} [columnName=null] The optional column name to filter tasks by
 * @return {Promise<Set>} A set of task ids
 */
export function findTrackedTasks(columnName?: string|null): Promise<Set<string>>;

/**
 * Get a list of untracked tasks (i.e. markdown files in the tasks folder that aren't listed in the index)
 * @return {Promise<Set>} A set of untracked task ids
 */
export function findUntrackedTasks(): Promise<Set<string>>;

/**
 * Update an existing task
 * @param {string} taskId The id of the task to update
 * @param {object} taskData The new task data
 * @param {?string} [columnName=null] The column name to move this task to, or null if not moving this task
 * @return {Promise<string>} The id of the task that was updated
 */
export function updateTask(taskId: string, taskData: object, columnName?: string|null): Promise<string>;

/**
 * Change a task name, rename the task file and update the task id in the index
 * @param {string} taskId The id of the task to rename
 * @param {string} newTaskName The new task name
 * @return {Promise<string>} The new id of the task that was renamed
 */
export function renameTask(taskId: string, newTaskName: string): Promise<string>;

/**
 * Move a task from one column to another column
 * @param {string} taskId The task id to move
 * @param {string} columnName The name of the column that the task will be moved to
 * @param {?number} [position=null] The position to move the task to within the target column
 * @param {boolean} [relative=false] Treat the position argument as relative instead of absolute
 * @return {Promise<string>} The id of the task that was moved
 */
export function moveTask(taskId: string, columnName: string, position?: number|null, relative?: boolean): Promise<string>;

/**
 * Remove a task from the index and optionally delete the task file as well
 * @param {string} taskId The id of the task to remove
 * @param {boolean} [removeFile=false] True if the task file should be removed
 * @return {string} The id of the task that was deleted
 */
export function deleteTask(taskId: string, removeFile?: boolean): Promise<string>;

/**
 * Search for indexed tasks
 * @param {object} [filters={}] The filters to apply
 * @param {boolean} [quiet=false] Only return task ids if true, otherwise return full task details
 * @return {Promise<object[]>} A list of tasks that match the filters
 */
export function search(filters?: object, quiet?: boolean): Promise<object[]>;

/**
 * Output project status information
 * @param {boolean} [quiet=false] Output full or partial status information
 * @param {boolean} [untracked=false] Show a list of untracked tasks
 * @param {boolean} [due=false] Show information about overdue tasks and time remaining
 * @param {?string|?number} [sprint=null] The sprint name or number to show stats for, or null for current sprint
 * @param {?Date[]} [dates=null] The date(s) to show stats for, or null for no date filter
 * @return {Promise<status>} Project status information as an object
 */
export function status(
  quiet?: boolean,
  untracked?: boolean,
  due?: boolean,
  sprint?: string|number|null,
  dates?: Date[]|null
): Promise<status>;

/**
 * Validate the index and task files
 * @param {boolean} [save=false] Re-save all files
 * @return {Promise<boolean>} True if everything validated, otherwise an array of parsing errors
 */
export function validate(save?: boolean): Promise<boolean>;

/**
 * Sort a column in the index
 * @param {string} columnName The column name to sort
 * @param {object[]} sorters A list of objects containing the field to sort by, filters and sort order
 * @param {boolean} [save=false] True if the settings should be saved in index
 * @return {Promise<void>}
 */
export function sort(columnName: string, sorters: object[], save?: boolean): Promise<void>;

/**
 * Start a sprint
 * @param {string} name Sprint name
 * @param {string} description Sprint description
 * @param {Date} start Sprint start date
 * @return {Promise<sprint>} The sprint object
 */
export function sprint(name: string, description: string, start: Date): Promise<sprint>;

/**
 * Output burndown chart data
 * @param {?string[]} [sprints=null] The sprint names or numbers to show a chart for, or null for
 * the current sprint
 * @param {?Date[]} [dates=null] The dates to show a chart for, or null for no date filter
 * @param {?string} [assigned=null] The assigned user to filter for, or null for no assigned filter
 * @param {?string[]} [columns=null] The columns to filter for, or null for no column filter
 * @return {Promise<object>} Burndown chart data as an object
 */
export function burndown(
  sprints?: string[]|null,
  dates?: Date[]|null,
  assigned?: string|null,
  columns?: string[]|null
): Promise<object>;

/**
 * Add a comment to a task
 * @param {string} taskId The task id
 * @param {string} text The comment text
 * @param {string} author The comment author
 * @return {Promise<string>} The task id
 */
export function comment(taskId: string, text: string, author: string): Promise<string>;

/**
 * Nuke it from orbit, it's the only way to be sure
 * @return {Promise<void>}
 */
export function removeAll(): Promise<void>;
