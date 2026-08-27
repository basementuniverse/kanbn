/// <reference types="typescript" />

declare type config = {
  mainFolder?: string,
  indexFile?: string,
  taskFolder?: string,
  archiveFolder?: string,
  defaultBoard?: string,
  boards?: {
    exclude?: string[],
    order?: string[],
    [slug: string]: any
  }
};

declare type board = {
  slug: string,
  path: string,
  name: string,
  description: string,
  main: boolean
};

declare type boardSummary = board & {
  columns: number,
  tasks: number,
  completed: number,
  completedPercentage: number,
  modified: Date | null
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
  constructor(root?: any, options?: { board?: string, caches?: any });
  ROOT: string;
  CONFIG_YAML: string;
  CONFIG_JSON: string;
  configMemo: any;
  /**
   * The board this instance is scoped to, or null for the main board
   */
  boardSlug: string | null;
  /**
   * Get a copy of this instance scoped to another board, sharing this one's cached config
   * @param {?string} [slug=null] The board slug, or null/"main"/"default" for the main board
   */
  board(slug?: string | null): Kanbn;
  /**
   * Alias for board()
   */
  withBoard(slug?: string | null): Kanbn;
  /**
   * Check if a separate config file exists
   * @returns {Promise<boolean>} True if a config file exists
   */
  configExists(): Promise<boolean>;
  /**
   * Save configuration data to a separate config file
   */
  saveConfig(config: any): Promise<void>;
  /**
   * Get configuration settings from the config file if it exists, otherwise return null
   * @return {Promise<Object|null>} Configuration settings or null if there is no separate config file
   */
  getConfig(): Promise<any | null>;
  /**
   * Clear cached config
   */
  clearConfigCache(): void;
  /**
   * Get the name of the folder where the index and tasks are stored
   * @return {Promise<string>} The kanbn folder name
   */
  getFolderName(): Promise<string>;
  /**
   * Get the index filename
   * @return {Promise<string>} The index filename
   */
  getIndexFileName(): Promise<string>;
  /**
   * Get the name of the folder where tasks are stored
   * @return {Promise<string>} The task folder name
   */
  getTaskFolderName(): Promise<string>;
  /**
   * Get the name of the archive folder
   * @return {Promise<string>} The archive folder name
   */
  getArchiveFolderName(): Promise<string>;
  /**
   * Get the kanbn folder location for the current working directory
   * @return {Promise<string>} The kanbn folder path
   */
  getMainFolder(): Promise<string>;
  /**
   * Get the main board's slug, i.e. the index file name without its extension
   * @return {Promise<string>} The main board slug
   */
  getMainBoardSlug(): Promise<string>;
  /**
   * Resolve a board slug, mapping the reserved aliases and an absent slug onto the main board
   * @param {?string} [slug] The board slug, defaulting to this instance's board
   */
  resolveBoardSlug(slug?: string | null): Promise<string>;
  /**
   * Check if a slug refers to the main board
   */
  isMainBoard(slug?: string | null): Promise<boolean>;
  /**
   * Get the file path for a board
   */
  getBoardPath(slug?: string | null): Promise<string>;
  /**
   * Get the index path, i.e. the path of the board this instance is scoped to
   * @return {Promise<string>} The kanbn index path
   */
  getIndexPath(): Promise<string>;
  /**
   * Get the task folder path
   * @return {Promise<string>} The kanbn task folder path
   */
  getTaskFolderPath(): Promise<string>;
  /**
   * Get the archive folder path
   * @return {Promise<string>} The kanbn archive folder path
   */
  getArchiveFolderPath(): Promise<string>;
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
   * Get the workspace-scoped options, from the config file or the main board's front matter
   */
  getWorkspaceOptions(): Promise<Record<string, any>>;
  /**
   * Load the workspace options along with where they came from
   */
  loadWorkspaceOptions(): Promise<{ options: Record<string, any>, fromConfig: boolean }>;
  /**
   * Get the options a secondary board inherits from the workspace
   */
  getInheritedBoardOptions(): Promise<Record<string, any>>;
  /**
   * Get the per-board options declared for a board under the `boards` key in the config file
   */
  getBoardConfig(slug?: string | null): Promise<Record<string, any>>;
  /**
   * Layer a board's own front matter options over the workspace options
   */
  resolveBoardOptions(resolvedSlug: string, ownOptions: Record<string, any>): Promise<Record<string, any>>;
  /**
   * Work out which options belong in a secondary board's own front matter
   */
  getOwnBoardOptions(resolvedSlug: string, indexData: object): Promise<Record<string, any>>;
  /**
   * Overwrite a board file with the specified data
   */
  saveBoard(slug: string | null, indexData: object): Promise<void>;
  /**
   * Load a board file and parse it to an object
   */
  loadBoard(slug?: string | null): Promise<index>;
  /**
   * Work out which board a command should target: --board, then KANBN_BOARD, then defaultBoard
   */
  resolveTargetBoard(slug?: string | null): Promise<string | null>;
  /**
   * Get a Kanbn instance scoped to the board a command's arguments point at
   */
  boardFromArgs(args?: object): Promise<Kanbn>;
  /**
   * Find all boards in the workspace
   */
  listBoards(): Promise<board[]>;
  /**
   * List boards with column and task counts, completion percentage and last modified date
   */
  getBoardsSummary(): Promise<boardSummary[]>;
  /**
   * Get every task that appears on more than one board, with the column it occupies on each
   */
  getCrossBoardTasks(allTasks?: boolean): Promise<{ id: string, boards: Record<string, string> }[]>;
  /**
   * Check if a board exists
   */
  boardExists(slug: string): Promise<boolean>;
  /**
   * Get the value to record in a history event's `board` key, or null for the main board
   */
  historyBoard(): Promise<string | null>;
  /**
   * Add an existing task to this board
   */
  addTaskToBoard(taskId: string, columnName: string): Promise<string>;
  /**
   * Check if a task file exists, regardless of whether any board references it
   */
  taskFileExists(taskId: string): Promise<boolean>;
  /**
   * Boards named in an archived task's metadata that no longer existed when it was restored
   */
  lastRestoreWarnings: string[];
  /**
   * Create a new board
   */
  createBoard(slug: string, options?: object): Promise<string>;
  /**
   * Create a secondary board, or update an existing one
   */
  initialiseBoard(slug: string, options?: object): Promise<string>;
  /**
   * Delete a board file, returning the ids of tasks that are no longer on any board
   */
  deleteBoard(slug: string): Promise<string[]>;
  /**
   * Find the tasks that would become untracked if a board were deleted
   */
  findOrphanedTasks(slug: string): Promise<string[]>;
  /**
   * Rename a board
   */
  renameBoard(slug: string, newSlug: string, newName?: string | null): Promise<string>;
  /**
   * Find every board that references a task, and the column it occupies on each
   */
  findTaskBoards(taskId: string): Promise<Record<string, string>>;
  /**
   * Alias for findTaskBoards()
   */
  getTaskBoardColumns(taskId: string): Promise<Record<string, string>>;
  /**
   * Get the slugs that can't be used for a board
   */
  getReservedBoardSlugs(): Promise<string[]>;
  /**
   * Check that a slug can be used for a new board, throwing if it can't
   */
  validateBoardSlug(slug: string): Promise<string>;
  /**
   * Get the boards config from the config file, i.e. the exclude list and display order
   */
  getBoardsConfig(): Promise<{ exclude: string[], order: string[] }>;
  /**
   * Find tasks that no board references at all
   */
  findWorkspaceUntrackedTasks(): Promise<Set<string>>;
  /**
   * Find tasks that other boards track but this one doesn't
   */
  findTasksOnOtherBoards(): Promise<Record<string, Record<string, string>>>;
  /**
   * Load the index file and parse it to an object
   * @return {Promise<object>} The index object
   */
  loadIndex(): Promise<object>;
  /**
   * Overwrite a task file with the specified data
   * @param {string} path The task path
   * @param {object} taskData The task data
   */
  saveTask(path: string, taskData: object): Promise<void>;
  /**
   * Load a task file and parse it to an object
   * @param {string} taskId The task id
   * @return {Promise<object>} The task object
   */
  loadTask(taskId: string): Promise<object>;
  /**
   * Load all tracked tasks and return an array of task objects
   * @param {object} index The index object
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {Promise<object[]>} All tracked tasks
   */
  loadAllTrackedTasks(index: object, columnName?: string | null): Promise<object[]>;
  /**
   * Load a task file from the archive and parse it to an object
   * @param {string} taskId The task id
   * @return {Promise<object>} The task object
   */
  loadArchivedTask(taskId: string): Promise<object>;
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
   * @return {Promise<boolean>} True if the current working directory has been initialised, otherwise false
   */
  initialised(): Promise<boolean>;
  /**
   * Check if the workspace has been initialised, regardless of which board this instance is scoped to
   * @return {Promise<boolean>} True if the main board exists
   */
  workspaceInitialised(): Promise<boolean>;
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
   * Get the column that a task is in or throw an error if the task doesn't exist or isn't indexed
   * @param {string} taskId The task id to find
   * @return {Promise<string>} The name of the column the task is in
   */
  findTaskColumn(taskId: string): Promise<string>;
  /**
   * Create a task file and add the task to the index
   * @param {object} taskData The task object
   * @param {string} columnName The name of the column to add the task to
   * @return {Promise<string>} The id of the task that was created
   */
  createTask(taskData: object, columnName: string): Promise<string>;
  /**
   * Add an untracked task to the specified column in the index
   * @param {string} taskId The untracked task id
   * @param {string} columnName The column to add the task to
   * @return {Promise<string>} The id of the task that was added
   */
  addUntrackedTaskToIndex(taskId: string, columnName: string): Promise<string>;
  /**
   * Get a list of tracked tasks (i.e. tasks that are listed in the index)
   * @param {?string} [columnName=null] The optional column name to filter tasks by
   * @return {Promise<Set>} A set of task ids
   */
  findTrackedTasks(columnName?: string | null): Promise<Set<any>>;
  /**
   * Get a list of untracked tasks (i.e. markdown files in the tasks folder that aren't listed in the index)
   * @return {Promise<Set>} A set of untracked task ids
   */
  findUntrackedTasks(): Promise<Set<any>>;
  /**
   * Update an existing task
   * @param {string} taskId The id of the task to update
   * @param {object} taskData The new task data
   * @param {?string} [columnName=null] The column name to move this task to, or null if not moving this task
   * @return {Promise<string>} The id of the task that was updated
   */
  updateTask(taskId: string, taskData: object, columnName?: string | null): Promise<string>;
  /**
   * Change a task name, rename the task file and update the task id in the index
   * @param {string} taskId The id of the task to rename
   * @param {string} newTaskName The new task name
   * @return {Promise<string>} The new id of the task that was renamed
   */
  renameTask(taskId: string, newTaskName: string): Promise<string>;
  /**
   * Move a task from one column to another column
   * @param {string} taskId The task id to move
   * @param {string} columnName The name of the column that the task will be moved to
   * @param {?number} [position=null] The position to move the task to within the target column
   * @param {boolean} [relative=false] Treat the position argument as relative instead of absolute
   * @return {Promise<string>} The id of the task that was moved
   */
  moveTask(taskId: string, columnName: string, position?: number | null, relative?: boolean, add?: boolean): Promise<string>;
  /**
   * Remove a task from the index and optionally delete the task file as well
   * @param {string} taskId The id of the task to remove
   * @param {boolean} [removeFile=false] True if the task file should be removed
   * @return {Promise<string>} The id of the task that was deleted
   */
  deleteTask(taskId: string, removeFile?: boolean, allBoards?: boolean): Promise<string>;
  /**
   * Search for indexed tasks
   * @param {object} [filters={}] The filters to apply
   * @param {boolean} [quiet=false] Only return task ids if true, otherwise return full task details
   * @return {Promise<object[]>} A list of tasks that match the filters
   */
  search(filters?: object, quiet?: boolean): Promise<object[]>;
  /**
   * Output project status information
   * @param {boolean} [quiet=false] Output full or partial status information
   * @param {boolean} [untracked=false] Show a list of untracked tasks
   * @param {boolean} [due=false] Show information about overdue tasks and time remaining
   * @param {?string|?number} [sprint=null] The sprint name or number to show stats for, or null for current sprint
   * @param {?Date[]} [dates=null] The date(s) to show stats for, or null for no date filter
   * @return {Promise<object|string[]>} Project status information as an object, or an array of untracked task filenames
   */
  status(quiet?: boolean, untracked?: boolean, due?: boolean, sprint?: (string | (number | null)) | null, dates?: Date[] | null): Promise<object | string[]>;
  /**
   * Validate the index and task files
   * @param {boolean} [save=false] Re-save all files
   * @return {Promise<boolean>} True if everything validated, otherwise an array of parsing errors
   */
  validate(save?: boolean): Promise<boolean>;
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
   * @return {Promise<object>} The sprint object
   */
  sprint(name: string, description: string, start: Date): Promise<object>;
  /**
   * Output burndown chart data
   * @param {?string[]} [sprints=null] The sprint names or numbers to show a chart for, or null for
   * the current sprint
   * @param {?Date[]} [dates=null] The dates to show a chart for, or null for no date filter
   * @param {?string} [assigned=null] The assigned user to filter for, or null for no assigned filter
   * @param {?string[]} [columns=null] The columns to filter for, or null for no column filter
   * @param {?string} [normalise=null] The date normalisation mode
   * @return {Promise<object>} Burndown chart data as an object
   */
  burndown(sprints?: string[] | null, dates?: Date[] | null, assigned?: string | null, columns?: string[] | null, normalise?: string | null): Promise<object>;
  /**
   * Add a comment to a task
   * @param {string} taskId The task id
   * @param {string} text The comment text
   * @param {string} author The comment author
   * @return {Promise<string>} The task id
   */
  comment(taskId: string, text: string, author: string): Promise<string>;
  /**
   * Return a list of archived tasks
   * @return {Promise<string[]>} A list of archived task ids
   */
  listArchivedTasks(): Promise<string[]>;
  /**
   * Move a task to the archive
   * @param {string} taskId The task id
   * @return {Promise<string>} The task id
   */
  archiveTask(taskId: string): Promise<string>;
  /**
   * Restore a task from the archive
   * @param {string} taskId The task id
   * @param {?string} [columnName=null] The column to restore the task to
   * @return {Promise<string>} The task id
   */
  restoreTask(taskId: string, columnName?: string | null, singleBoard?: boolean): Promise<string>;
  /**
   * Nuke it from orbit, it's the only way to be sure
   */
  removeAll(): Promise<void>;
}
