const workspace = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

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
function startSprint(name, description, verbose, secondaryBoard) {
  kanbn
  .sprint(name, description, new Date())
  .then(sprint => {
    console.log(`Started new sprint "${sprint.name}" at ${sprint.start.toISOString()}`);

    // Sprints are workspace-level unless a board declares its own list, so say where this one went
    // rather than leaving the user to guess which file changed
    if (verbose && secondaryBoard) {
      console.log(utility.replaceTags(
        sprint.board === null
          ? '{d}Added to the workspace sprint list{d}'
          : `{d}Added to board "${sprint.board}"'s own sprint list{d}`
      ));
    }
  })
  .catch(error => {
    utility.error(error);
  });
}

module.exports = async args => {

  // Work out which board this command targets
  const scoped = await utility.resolveBoard(workspace, args);
  if (scoped === null) {
    return;
  }
  kanbn = scoped;

  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error);
    return;
  }
  const verbose = kanbn.isVerbose(index);
  const secondaryBoard = !(await kanbn.isMainBoard());

  // Get sprint settings from arguments
  // Name
  let name = '';
  if (args.name) {
    name = utility.strArg(args.name);
  }

  // Description
  let description = '';
  if (args.description) {
    description = utility.strArg(args.description);
  }

  // Start sprint interactively
  if (args.interactive) {
    interactive(name, description)
    .then(answers => {
      startSprint(answers.name, answers.description || '', verbose, secondaryBoard);
    })
    .catch(error => {
      utility.error(error);
    });

  // Otherwise start sprint non-interactively
  } else {
    startSprint(name, description, verbose, secondaryBoard);
  }
};
