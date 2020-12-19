const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

/**
 * Initialise kanbn interactively
 * @param {object} options
 * @param {boolean} initialised
 * @return {Promise<any>}
 */
async function interactive(options, initialised) {
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
            if (options.columns.indexOf(value) !== -1) {
              return 'Column name already exists';
            }
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
 */
function initialise(options, initialised) {
  kanbn
  .initialise(options)
  .then(() => {
    if (initialised) {
      console.log(`Reinitialised existing kanbn board in ${kanbn.getMainFolder()}`);
    } else {
      console.log(`Initialised empty kanbn board in ${kanbn.getMainFolder()}`);
    }
  })
  .catch(error => {
    utility.error(error, true);
  });
}

module.exports = async args => {
  let options = {};

  // If this folder is already initialised, set the default name and description using the current values
  const initialised = await kanbn.initialised();
  if (initialised) {
    try {
      const index = await kanbn.getIndex();
      options.name = index.name;
      options.description = index.description;
      options.columns = Object.keys(index.columns);
    } catch (error) {
      utility.error(error, true);
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
    .then(answers => {
      if ('columns' in answers) {
        answers.columns = answers.columns.map(column => column.columnName);
      }
      initialise(answers, initialised);
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Non-interactive initialisation
  } else {
    initialise(options, initialised);
  }
};
