const kanbn = require('../lib/main');
const inquirer = require('inquirer');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

/**
 * Initialise kanbn interactively
 * @param {object} options
 * @param {boolean} initialised
 */
async function interactive(options, initialised) {
  return await inquirer
  .prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Project title:',
      default: options.title || '',
      validate: function (value) {
        if ((/.+/).test(value)) {
          return true;
        }
        return 'Project title cannot be empty';
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: options.description || ''
    },
    {
      type: 'recursive',
      message: 'Add a column?',
      name: 'columns',
      when: () => !initialised,
      prompts: [
        {
          type: 'input',
          name: 'columnName',
          message: 'Column name:',
          validate: function (value) {
            if ((/.+/).test(value)) {
              return true;
            }
            return 'Column name cannot be empty';
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
    console.error(error.message);
  });
}

module.exports = async (args) => {
  let options = {};

  // If this folder is already initialised, set the default title and description using the current values
  const initialised = await kanbn.initialised();
  if (initialised) {
    try {
      const index = await kanbn.getIndex();
      options.title = index.title;
      options.description = index.description;
    } catch (error) {
      console.error(error.message);
      return;
    }
  }

  // Check for arguments and override the defaults if present
  if (args.title) {
    options.title = args.title;
  }
  if (args.description) {
    options.description = args.description;
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
      console.error(error.message);
    });
  // Non-interactive initialisation
  } else {
    initialise(options, initialised);
  }
};
