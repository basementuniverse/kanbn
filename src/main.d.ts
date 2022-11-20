/// <reference types="typescript" />

declare type config = {
  mainFolder?: string,
  indexFile?: string,
  taskFolder?: string,
  archiveFolder?: string
};

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
  columnTasks: Record<string, number>,
  startedTasks?: number,
  completedTasks?: number
};

declare type sprint = {
  start: Date,
  name: string,
  description?: string
};

export class Kanbn {
  constructor(root?: any);
  ROOT: string;
  CONFIG_YAML: string;
  CONFIG_JSON: string;
  configMemo: any;
  /**
   * Check if a file or folder exists
   * @param {string} path
   * @return {boolean} True if the file or folder exists
   */
  exists(path: string): boolean;
  /**
   * Check if a separate config file exists
   * @returns {boolean} True if a config file exists
   */
  configExists(): boolean;
  /**
   * Save configuration data to a separate config file
   */
  saveConfig(config: any): Promise<void>;
  /**
   * Get a task path from the id
   * @param {string} tasksPath The path to the tasks folder
   * @param {string} taskId The task id
   * @return {string} The task path
   */
  getTaskPath(tasksPath: string, taskId: string): string;
  /**
   * Add the file extension to an id if it doesn't already have one
   * @param {string} taskId The task id
   * @return {string} The task id with .md extension
   */
  addFileExtension(taskId: string): string;
  /**
   * Remove the file extension from an id if it has one
   * @param {string} taskId The task id
   * @return {string} The task id without .md extension
   */
  removeFileExtension(taskId: string): string;
  /**
   * Get a list of all tracked task ids
   * @param {object} index The index object
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {Set} A set of task ids appearing in the index
   */
  getTrackedTaskIds(index: object, columnName?: string | null): Set<any>;
  /**
   * Check if a task exists in the index
   * @param {object} index The index object
   * @param {string} taskId The task id to search for
   * @return {boolean} True if the task exists in the index
   */
  taskInIndex(index: object, taskId: string): boolean;
  /**
   * Find a task in the index and returns the column that it's in
   * @param {object} index The index data
   * @param {string} taskId The task id to search for
   * @return {?string} The column name for the specified task, or null if it wasn't found
   */
  findTaskColumn(index: object, taskId: string): string | null;
  /**
   * Get the column that a task is in or throw an error if the task doesn't exist or isn't indexed
   * @param {string} taskId The task id to find
   * @return {string} The name of the column the task is in
   */
  findTaskColumn(taskId: string): string;
  /**
   * Add a task id to the specified column in the index
   * @param {object} index The index object
   * @param {string} taskId The task id to add
   * @param {string} columnName The column to add the task to
   * @param {?number} [position=null] The position in the column to move the task to, or last position if null
   * @return {object} The modified index object
   */
  addTaskToIndex(index: object, taskId: string, columnName: string, position?: number | null): object;
  /**
   * Remove all instances of a task id from the index
   * @param {object} index The index object
   * @param {string} taskId The task id to remove
   * @return {object} The modified index object
   */
  removeTaskFromIndex(index: object, taskId: string): object;
  /**
   * Rename all instances of a task id in the index
   * @param {object} index The index object
   * @param {string} taskId The task id to rename
   * @param {string} newTaskId The new task id
   * @return {object} The modified index object
   */
  renameTaskInIndex(index: object, taskId: string, newTaskId: string): object;
  /**
   * Get a metadata property from a task, or undefined if the metadata property doesn't exist or
   * if the task has no metadata
   * @param {object} taskData The task object
   * @param {string} property The metadata property to check
   * @return {any} The metadata property value
   */
  getTaskMetadata(taskData: object, property: string): any;
  /**
   * Set a metadata value in a task. If the value is undefined, remove the metadata property instead
   * @param {object} taskData The task object
   * @param {string} property The metadata property to update
   * @param {string} value The value to set
   * @return {object} The modified task object
   */
  setTaskMetadata(taskData: object, property: string, value: string): object;
  /**
   * Check if a task is completed
   * @param {object} index
   * @param {object} task
   * @return {boolean} True if the task is in a completed column or has a completed date
   */
  taskCompleted(index: object, task: object): boolean;
  /**
   * Sort a column in the index
   * @param {object} index The index object
   * @param {object[]} tasks The tasks in the index
   * @param {string} columnName The column to sort
   * @param {object[]} sorters A list of sorter objects
   * @return {object} The modified index object
   */
  sortColumnInIndex(index: object, tasks: object[], columnName: string, sorters: object[]): object;
  /**
   * Sort a list of tasks
   * @param {object[]} tasks
   * @param {object[]} sorters
   * @return {object[]} The sorted tasks
   */
  sortTasks(tasks: object[], sorters: object[]): object[];
  /**
   * Transform a value using a sort filter regular expression
   * @param {string} value
   * @param {string} filter
   * @return {string} The transformed value
   */
  sortFilter(value: string, filter: string): string;
  /**
   * Compare two values (supports string, date and number values)
   * @param {any} a
   * @param {any} b
   * @return {number} A positive value if a > b, negative if a < b, otherwise 0
   */
  compareValues(a: any, b: any): number;
  /**
   * Filter a list of tasks using a filters object containing field names and filter values
   * @param {object} index
   * @param {object[]}} tasks
   * @param {object} filters
   */
  filterTasks(index: object, tasks: any, filters: object): any;
  /**
   * Check if the input string matches the filter regex
   * @param {string|string[]} filter A regular expression or array of regular expressions
   * @param {string} input The string to match against
   * @return {boolean} True if the input matches the string filter
   */
  stringFilter(filter: string | string[], input: string): boolean;
  /**
   * Check if the input date matches a date (ignore time part), or if multiple dates are passed in, check if the
   * input date is between the earliest and latest dates
   * @param {Date|Date[]} dates A date or list of dates to check against
   * @param {Date} input The input date to match against
   * @return {boolean} True if the input matches the date filter
   */
  dateFilter(dates: Date | Date[], input: Date): boolean;
  /**
   * Check if the input matches a number, or if multiple numbers are passed in, check if the input is between the
   * minimum and maximum numbers
   * @param {number|number[]} filter A filter number or array of filter numbers
   * @param {number} input The number to match against
   * @return {boolean} True if the input matches the number filter
   */
  numberFilter(filter: number | number[], input: number): boolean;
  /**
   * Calculate task workload
   * @param {object} index The index object
   * @param {object} task The task object
   * @return {number} The task workload
   */
  taskWorkload(index: object, task: object): number;
  /**
   * Get task progress amount
   * @param {object} index
   * @param {object} task
   * @return {number} Task progress
   */
  taskProgress(index: object, task: object): number;
  /**
   * Calculate task workload statistics between a start and end date
   * @param {object[]} tasks
   * @param {string} metadataProperty
   * @param {Date} start
   * @param {Date} end
   * @return {object} A statistics object
   */
  taskWorkloadInPeriod(tasks: object[], metadataProperty: string, start: Date, end: Date): object;
  /**
   * Get a list of tasks that were started before and/or completed after a date
   * @param {object[]} tasks
   * @param {Date} date
   * @return {object[]} A filtered list of tasks
   */
  getActiveTasksAtDate(tasks: object[], date: Date): object[];
  /**
   * Calculate the total workload at a specific date
   * @param {object[]} tasks
   * @param {Date} date
   * @return {number} The total workload at the specified date
   */
  getWorkloadAtDate(tasks: object[], date: Date): number;
  /**
   * Get the number of tasks that were active at a specific date
   * @param {object[]} tasks
   * @param {Date} date
   * @return {number} The total number of active tasks at the specified date
   */
  countActiveTasksAtDate(tasks: object[], date: Date): number;
  /**
   * Get a list of tasks that were started or completed on a specific date
   * @param {object[]} tasks
   * @param {Date} date
   * @return {object[]} A list of event objects, with event type and task id
   */
  getTaskEventsAtDate(tasks: object[], date: Date): object[];
  /**
   * Quantize a burndown chart date to 1-hour resolution
   * @param {Date} date
   * @param {string} resolution One of 'days', 'hours', 'minutes', 'seconds'
   * @return {Date} The quantized dates
   */
  normaliseDate(date: Date, resolution?: string): Date;
  /**
   * If a task's column is linked in the index to a custom field with type date, update the custom field's value
   * in the task data with the current date
   * @param {object} index
   * @param {object} taskData
   * @param {string} columnName
   * @return {object} The updated task data
   */
  updateColumnLinkedCustomFields(index: object, taskData: object, columnName: string): object;
  /**
   * If index options contains a list of columns linked to a custom field name and a task's column matches one
   * of the columns in this list, set the task's custom field value to the current date depending on criteria:
   * - if 'once', update the value only if it's not currently set
   * - if 'always', update the value regardless
   * - otherwise, don't update the value
   * @param {object} index
   * @param {object} taskData
   * @param {string} columnName
   * @param {string} fieldName
   * @param {string} [updateCriteria='none']
   */
  updateColumnLinkedCustomField(index: object, taskData: object, columnName: string, fieldName: string, updateCriteria?: string): any;
  /**
   * Get configuration settings from the config file if it exists, otherwise return null
   * @return {Object|null} Configuration settings or null if there is no separate config file
   */
  getConfig(): any | null;
  /**
   * Clear cached config
   */
  clearConfigCache(): void;
  /**
   * Get the name of the folder where the index and tasks are stored
   * @return {string} The kanbn folder name
   */
  getFolderName(): string;
  /**
   * Get the index filename
   * @return {string} The index filename
   */
  getIndexFileName(): string;
  /**
   * Get the name of the folder where tasks are stored
   * @return {string} The task folder name
   */
  getTaskFolderName(): string;
  /**
   * Get the name of the archive folder
   * @return {string} The archive folder name
   */
  getArchiveFolderName(): string;
  /**
   * Get the kanbn folder location for the current working directory
   * @return {string} The kanbn folder path
   */
  getMainFolder(): string;
  /**
   * Get the index path
   * @return {string} The kanbn index path
   */
  getIndexPath(): string;
  /**
   * Get the task folder path
   * @return {string} The kanbn task folder path
   */
  getTaskFolderPath(): string;
  /**
   * Get the archive folder path
   * @return {string} The kanbn archive folder path
   */
  getArchiveFolderPath(): string;
  /**
   * Get the index as an object
   * @return {Promise<index>} The index
   */
  getIndex(): Promise<index>;
  /**
   * Get a task as an object
   * @param {string} taskId The task id to get
   * @return {Promise<task>} The task
   */
  getTask(taskId: string): Promise<task>;
  /**
   * Add additional index-based information to a task
   * @param {index} index The index object
   * @param {task} task The task object
   * @return {task} The hydrated task
   */
  hydrateTask(index: any, task: any): any;
  /**
   * Return a filtered and sorted list of tasks
   * @param {index} index The index object
   * @param {task[]} tasks A list of task objects
   * @param {object} filters A list of task filters
   * @param {object[]} sorters A list of task sorters
   * @return {object[]} A filtered and sorted list of tasks
   */
  filterAndSortTasks(index: any, tasks: task[], filters: object, sorters: object[]): object[];
  /**
   * Overwrite the index file with the specified data
   * @param {object} indexData Index data to save
   */
  saveIndex(indexData: object): Promise<void>;
  /**
   * Load the index file and parse it to an object
   * @return {object} The index object
   */
  loadIndex(): object;
  /**
   * Overwrite a task file with the specified data
   * @param {string} path The task path
   * @param {object} taskData The task data
   */
  saveTask(path: string, taskData: object): Promise<void>;
  /**
   * Load a task file and parse it to an object
   * @param {string} taskId The task id
   * @return {object} The task object
   */
  loadTask(taskId: string): object;
  /**
   * Load all tracked tasks and return an array of task objects
   * @param {object} index The index object
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {object[]} All tracked tasks
   */
  loadAllTrackedTasks(index: object, columnName?: string | null): object[];
  /**
   * Load a task file from the archive and parse it to an object
   * @param {string} taskId The task id
   * @return {object} The task object
   */
  loadArchivedTask(taskId: string): object;
  /**
   * Get the date format defined in the index, or the default date format
   * @param {object} index The index object
   * @return {string} The date format
   */
  getDateFormat(index: object): string;
  /**
   * Get the task template for displaying tasks on the kanbn board from the index, or the default task template
   * @param {object} index The index object
   * @return {string} The task template
   */
  getTaskTemplate(index: object): string;
  /**
   * Check if the current working directory has been initialised
   * @return {boolean} True if the current working directory has been initialised, otherwise false
   */
  initialised(): boolean;
  /**
   * Initialise a kanbn board in the current working directory
   * @param {object} [options={}] Initial columns and other config options
   */
  initialise(options?: object): Promise<void>;
  /**
   * Check if a task file exists and is in the index, otherwise throw an error
   * @param {string} taskId The task id to check
   */
  taskExists(taskId: string): Promise<void>;
  /**
   * Create a task file and add the task to the index
   * @param {object} taskData The task object
   * @param {string} columnName The name of the column to add the task to
   * @return {string} The id of the task that was created
   */
  createTask(taskData: object, columnName: string): string;
  /**
   * Add an untracked task to the specified column in the index
   * @param {string} taskId The untracked task id
   * @param {string} columnName The column to add the task to
   * @return {string} The id of the task that was added
   */
  addUntrackedTaskToIndex(taskId: string, columnName: string): string;
  /**
   * Get a list of tracked tasks (i.e. tasks that are listed in the index)
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {Set} A set of task ids
   */
  findTrackedTasks(columnName?: string | null): Set<any>;
  /**
   * Get a list of untracked tasks (i.e. markdown files in the tasks folder that aren't listed in the index)
   * @return {Set} A set of untracked task ids
   */
  findUntrackedTasks(): Set<any>;
  /**
   * Update an existing task
   * @param {string} taskId The id of the task to update
   * @param {object} taskData The new task data
   * @param {?string} [columnName=null] The column name to move this task to, or null if not moving this task
   * @return {string} The id of the task that was updated
   */
  updateTask(taskId: string, taskData: object, columnName?: string | null): string;
  /**
   * Change a task name, rename the task file and update the task id in the index
   * @param {string} taskId The id of the task to rename
   * @param {string} newTaskName The new task name
   * @return {string} The new id of the task that was renamed
   */
  renameTask(taskId: string, newTaskName: string): string;
  /**
   * Move a task from one column to another column
   * @param {string} taskId The task id to move
   * @param {string} columnName The name of the column that the task will be moved to
   * @param {?number} [position=null] The position to move the task to within the target column
   * @param {boolean} [relative=false] Treat the position argument as relative instead of absolute
   * @return {string} The id of the task that was moved
   */
  moveTask(taskId: string, columnName: string, position?: number | null, relative?: boolean): string;
  /**
   * Remove a task from the index and optionally delete the task file as well
   * @param {string} taskId The id of the task to remove
   * @param {boolean} [removeFile=false] True if the task file should be removed
   * @return {string} The id of the task that was deleted
   */
  deleteTask(taskId: string, removeFile?: boolean): string;
  /**
   * Search for indexed tasks
   * @param {object} [filters={}] The filters to apply
   * @param {boolean} [quiet=false] Only return task ids if true, otherwise return full task details
   * @return {object[]} A list of tasks that match the filters
   */
  search(filters?: object, quiet?: boolean): object[];
  /**
   * Output project status information
   * @param {boolean} [quiet=false] Output full or partial status information
   * @param {boolean} [untracked=false] Show a list of untracked tasks
   * @param {boolean} [due=false] Show information about overdue tasks and time remaining
   * @param {?string|?number} [sprint=null] The sprint name or number to show stats for, or null for current sprint
   * @param {?Date[]} [dates=null] The date(s) to show stats for, or null for no date filter
   * @return {object|string[]} Project status information as an object, or an array of untracked task filenames
   */
  status(quiet?: boolean, untracked?: boolean, due?: boolean, sprint?: (string | (number | null)) | null, dates?: Date[] | null): object | string[];
  /**
   * Validate the index and task files
   * @param {boolean} [save=false] Re-save all files
   * @return {boolean} True if everything validated, otherwise an array of parsing errors
   */
  validate(save?: boolean): boolean;
  /**
   * Sort a column in the index
   * @param {string} columnName The column name to sort
   * @param {object[]} sorters A list of objects containing the field to sort by, filters and sort order
   * @param {boolean} [save=false] True if the settings should be saved in index
   */
  sort(columnName: string, sorters: object[], save?: boolean): Promise<void>;
  /**
   * Start a sprint
   * @param {string} name Sprint name
   * @param {string} description Sprint description
   * @param {Date} start Sprint start date
   * @return {object} The sprint object
   */
  sprint(name: string, description: string, start: Date): object;
  /**
   * Output burndown chart data
   * @param {?string[]} [sprints=null] The sprint names or numbers to show a chart for, or null for
   * the current sprint
   * @param {?Date[]} [dates=null] The dates to show a chart for, or null for no date filter
   * @param {?string} [assigned=null] The assigned user to filter for, or null for no assigned filter
   * @param {?string[]} [columns=null] The columns to filter for, or null for no column filter
   * @param {?string} [normalise=null] The date normalisation mode
   * @return {object} Burndown chart data as an object
   */
  burndown(sprints?: string[] | null, dates?: Date[] | null, assigned?: string | null, columns?: string[] | null, normalise?: string | null): object;
  /**
   * Add a comment to a task
   * @param {string} taskId The task id
   * @param {string} text The comment text
   * @param {string} author The comment author
   * @return {string} The task id
   */
  comment(taskId: string, text: string, author: string): string;
  /**
   * Return a list of archived tasks
   * @return {string[]} A list of archived task ids
   */
  listArchivedTasks(): string[];
  /**
   * Move a task to the archive
   * @param {string} taskId The task id
   * @return {string} The task id
   */
  archiveTask(taskId: string): string;
  /**
   * Restore a task from the archive
   * @param {string} taskId The task id
   * @param {?string} [columnName=null] The column to restore the task to
   * @return {string} The task id
   */
  restoreTask(taskId: string, columnName?: string | null): string;
  /**
   * Nuke it from orbit, it's the only way to be sure
   */
  removeAll(): Promise<void>;
}
