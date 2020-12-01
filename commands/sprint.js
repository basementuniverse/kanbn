const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

/**
 * Start a new sprint interactively
 * @param {?string} name The sprint name
 * @param {?string} description The sprint description
 */
async function interactiveSprint(name = null, description = null) {
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
  // console.log(name);
  // console.log(description);
  // return;
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
    utility.showError(error);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
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
    interactiveSprint(name, description)
    .then(answers => {
      startSprint(answers.name, answers.description || '');
    })
    .catch(error => {
      utility.showError(error);
    });

  // Otherwise start sprint non-interactively
  } else {
    startSprint(name, description);
  }
};
