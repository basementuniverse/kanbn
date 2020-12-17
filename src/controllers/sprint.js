const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

/**
 * Start a new sprint interactively
 * @param {?string} [name=null] The sprint name
 * @param {?string} [description=null] The sprint description
 * @return {Promise<any>}
 */
async function interactive(name = null, description = null) {
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Sprint name:',
      default: name || '',
      validate: async value => {
        if (!value) {
          return 'Sprint name cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'setDescription',
      message: 'Add a description?',
      default: false
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Sprint description:',
      default: description || '',
      when: answers => answers.setDescription
    }
  ]);
}

/**
 * Start a new sprint
 * @param {string} name
 * @param {string} description
 */
function startSprint(name, description) {
  const spinner = new Spinner('Starting sprint...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .sprint(name, description, new Date())
  .then(sprint => {
    spinner.stop(true);
    console.log(`Started new sprint "${sprint.name}" at ${sprint.start.toISOString()}`);
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get sprint settings from arguments
  // Name
  let name = '';
  if (args.name) {
    name = utility.argToString(args.name);
  }

  // Description
  let description = '';
  if (args.description) {
    description = utility.argToString(args.description);
  }

  // Start sprint interactively
  if (args.interactive) {
    interactive(name, description)
    .then(answers => {
      startSprint(answers.name, answers.description || '');
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise start sprint non-interactively
  } else {
    startSprint(name, description);
  }
};
