const kanbn_module = require('../main');
const workspace = new kanbn_module.Kanbn();
const utility = require('../utility');
const inquirer = require('inquirer');

// The board being initialised - set from --board before anything else runs
let kanbn = workspace;

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

/**
 * Initialise kanbn interactively
 * @param {object} options
 * @param {boolean} initialised
 * @return {Promise<any>}
 */
async function interactive(options, initialised) {
  const columnNames = [];
  return await inquirer
  .prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: options.name || '',
      validate: value => {
        if (!value) {
          return 'Project name cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'setDescription',
      message: initialised ? 'Edit the project description?' : 'Add a project description?'
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Project description:',
      default: options.description || '',
      when: answers => answers.setDescription
    },
    {
      type: 'recursive',
      initialMessage: 'Add a column?',
      message: 'Add another column?',
      name: 'columns',
      when: () => !initialised,
      prompts: [
        {
          type: 'input',
          name: 'columnName',
          message: 'Column name:',
          validate: value => {
            if (value.length === 0) {
              return 'Column name cannot be empty';
            }
            if (
              (options.columns || []).indexOf(value) !== -1 ||
              columnNames.indexOf(value) !== -1
            ) {
              return 'Column name already exists';
            }
            columnNames.push(value);
            return true;
          }
        }
      ]
    }
  ]);
}

/**
 * Initialise kanbn
 * @param {object} options
 * @param {boolean} initialised
 * @param {?string} boardSlug The slug of the board being initialised, or null for the main board
 */
async function initialise(options, initialised, boardSlug = null) {
  const mainFolder = await kanbn.getMainFolder();
  kanbn.initialise(options)
  .then(() => {
    if (boardSlug !== null) {
      console.log(
        initialised
          ? `Updated board "${boardSlug}" in ${mainFolder}`
          : `Created board "${boardSlug}" in ${mainFolder}`
      );
      return;
    }
    if (initialised) {
      console.log(`Reinitialised existing kanbn board in ${mainFolder}`);
    } else {
      console.log(`Initialised empty kanbn board in ${mainFolder}`);

      // Completion is the sort of thing nobody finds in a README, so mention it once, here
      const hint = require('./completion').installHint();
      if (hint !== null) {
        console.log(utility.replaceTags(`\n${hint}`));
      }
    }
  })
  .catch(error => {
    utility.error(error);
  });
}

module.exports = async args => {
  let options = {};

  // Work out which board we're initialising. Without --board this is the main board, i.e. the whole
  // workspace, which is exactly what init has always done
  let boardSlug = null;
  if (args.board) {
    boardSlug = utility.strArg(args.board);

    // A secondary board lives beside the main board and shares its tasks, so the workspace has to
    // exist first
    if (!await workspace.initialised()) {
      utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
      return;
    }
    try {
      boardSlug = await workspace.validateBoardSlug(boardSlug);
    } catch (error) {
      utility.error(error);
      return;
    }
    kanbn = workspace.board(boardSlug);
  } else {
    kanbn = workspace;
  }

  // If this folder is already initialised, set the default name and description using the current values
  const initialised = await kanbn.initialised();
  if (initialised) {
    try {
      const index = await kanbn.getIndex();
      options.name = index.name;
      options.description = index.description;
      options.columns = Object.keys(index.columns);
    } catch (error) {
      utility.error(error);
      return;
    }
  }

  // Check for arguments and override the defaults if present
  // Project name
  if (args.name) {
    options.name = utility.strArg(args.name);
  }

  // Project description
  if (args.description) {
    options.description = utility.strArg(args.description);
  }

  // Columns
  if (args.column) {
    options.columns = utility.arrayArg(args.column);
  }

  // Interactive initialisation
  if (args.interactive) {
    interactive(options, initialised)
    .then(async (answers) => {
      if ('columns' in answers) {
        answers.columns = answers.columns.map(column => column.columnName);
      }
      await initialise(answers, initialised, boardSlug);
    })
    .catch(error => {
      utility.error(error);
    });

  // Non-interactive initialisation
  } else {
    await initialise(options, initialised, boardSlug);
  }
};
