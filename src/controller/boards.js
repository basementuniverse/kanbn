const kanbn = require('../main');
const utility = require('../utility');

/**
 * Show the list of boards in this workspace
 * @param {object[]} boards
 * @param {boolean} json
 */
function showBoards(boards, json) {
  if (json) {
    console.log(JSON.stringify(boards, null, 2));
    return;
  }
  console.log(`${boards.length} ${boards.length === 1 ? 'board' : 'boards'}:`);
  for (const board of boards) {
    console.log(utility.replaceTags(`\n{b}${board.slug}{b}${board.main ? ' (main board)' : ''}`));
    console.log(`  ${board.name}`);
    if (board.description) {
      console.log(`  ${board.description.split('\n')[0]}`);
    }
    console.log(
      `  ${board.columns} ${board.columns === 1 ? 'column' : 'columns'}, ` +
      `${board.tasks} ${board.tasks === 1 ? 'task' : 'tasks'}, ` +
      `${board.completedPercentage}% complete` +
      (board.modified ? `, last modified ${board.modified.toISOString()}` : '')
    );
  }
}

/**
 * Show which boards each task appears on
 * @param {object[]} tasks
 * @param {boolean} all True if single-board tasks are included
 * @param {boolean} json
 */
function showCrossBoardTasks(tasks, all, json) {
  if (json) {
    console.log(JSON.stringify(tasks, null, 2));
    return;
  }
  if (!tasks.length) {
    console.log(all ? 'No tracked tasks found' : 'No tasks appear on more than one board');
    return;
  }
  console.log(
    `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}` +
    (all ? ':' : ' on more than one board:')
  );
  for (const task of tasks) {
    console.log(utility.replaceTags(`\n{b}${task.id}{b}`));
    for (const [slug, columnName] of Object.entries(task.boards)) {
      console.log(`  ${slug}: ${columnName}`);
    }
  }
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.workspaceInitialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }

  // Delete a board
  if (args.delete) {
    const slug = utility.strArg(args.delete);
    let orphaned;
    try {
      orphaned = await kanbn.findOrphanedTasks(slug);
    } catch (error) {
      utility.error(error);
      return;
    }

    // Deleting a board never deletes task files, but it can leave tasks with no board at all
    if (orphaned.length && !args.force) {
      utility.error(
        `Deleting board "${slug}" would leave ${orphaned.length} ` +
        `${orphaned.length === 1 ? 'task' : 'tasks'} untracked:\n` +
        orphaned.map(taskId => `  ${taskId}`).join('\n') +
        '\nUse {b}-f{b} to delete the board anyway'
      );
      return;
    }
    try {
      await kanbn.deleteBoard(slug);
    } catch (error) {
      utility.error(error);
      return;
    }
    console.log(
      `Deleted board "${slug}"` +
      (orphaned.length
        ? `\n${orphaned.length} ${orphaned.length === 1 ? 'task is' : 'tasks are'} now untracked:\n` +
          orphaned.map(taskId => `  ${taskId}`).join('\n')
        : '')
    );
    return;
  }

  // Rename a board, i.e. kanbn boards --rename design ux --name "UX Pipeline"
  if (args.rename) {
    const slug = utility.strArg(args.rename);
    const newSlug = args._[1] || slug;
    const newName = args.name ? utility.strArg(args.name) : null;
    if (newSlug === slug && newName === null) {
      utility.error('No new board slug or name specified\nTry running {b}kanbn boards --rename "board-slug" "new-slug"{b}');
      return;
    }
    try {
      const renamedSlug = await kanbn.renameBoard(slug, newSlug, newName);
      console.log(
        renamedSlug === slug
          ? `Renamed board "${slug}" to "${newName}"`
          : `Renamed board "${slug}" to "${renamedSlug}"`
      );
    } catch (error) {
      utility.error(error);
    }
    return;
  }

  // Show which boards each task appears on
  if (args.tasks) {
    try {
      showCrossBoardTasks(await kanbn.getCrossBoardTasks(args.all), args.all, args.json);
    } catch (error) {
      utility.error(error);
    }
    return;
  }

  // List boards
  try {
    showBoards(await kanbn.getBoardsSummary(), args.json);
  } catch (error) {
    utility.error(error);
  }
};
