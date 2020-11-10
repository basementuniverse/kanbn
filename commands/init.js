const kanbn = require('../lib/main');
const inquirer = require('inquirer');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

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
        return 'Project title cannot be empty!';
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
            return 'Column name cannot be empty!';
          }
        }
      ]
    }
  ]);
}

module.exports = (args) => {
  let options = {};

  // If this folder is already initialised, set the default title and description using the current values
  const initialised = kanbn.initialised();
  if (initialised) {
    const index = kanbn.getIndex();
    options.title = index.title;
    options.description = index.description;
  }

  // Check for arguments and override the defaults if present
  if (args.title) {
    options.title = args.title;
  }
  if (args.t) {
    options.title = args.t;
  }
  if (args.description) {
    options.description = args.description;
  }
  if (args.d) {
    options.description = args.d;
  }

  // Interactive initialisation
  if (args.interactive || args.n) {
    interactive(options, initialised)
    .then(answers => {
      if ('columns' in answers) {
        answers.columns = answers.columns.map(column => column.columnName);
      }
      kanbn.initialise(answers);
    })
    .catch(error => {
      console.log(error);
    });

  // Non-interactive initialisation
  } else {
    kanbn.initialise(options);
  }
};
