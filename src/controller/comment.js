const workspace = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');

// The board this command targets - set from --board before anything else runs
let kanbn = workspace;

/**
 * Add a comment interactively
 * @param {string} text
 * @param {string} author
 * @return {Promise<any>}
 */
async function interactive(text, author) {
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'text',
      message: 'Comment text:',
      default: text || '',
      validate: async value => {
        if (!value) {
          return 'Comment text cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: author || ''
    }
  ]);
}

/**
 * Add a comment
 * @param {string} taskId
 * @param {string} text
 * @param {string} author
 */
function addComment(taskId, text, author) {
  kanbn
  .comment(taskId, text, author)
  .then(taskId => {
    console.log(`Added comment to task "${taskId}"`);
    utility.showActionWarnings(kanbn);
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

  // Get the task that we're add a comment to
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn comment "task id"{b}');
    return;
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error);
    return;
  }

  // Get comment values from arguments
  let commentText = '', commentAuthor = '';

  // Text
  if (args.text) {
    commentText = utility.strArg(args.text);
  }

  // Author
  if (args.author && typeof args.author === 'string') {
    commentAuthor = utility.strArg(args.author);
  } else {

    // Nobody at all is a legitimate answer on a machine with no git identity, and an empty author is
    // what a comment without one looks like
    commentAuthor = (await kanbn.currentUser()) || '';
  }

  // Add comment interactively
  if (args.interactive) {
    interactive(commentText, commentAuthor)
    .then(answers => {
      addComment(taskId, answers.text, answers.author);
    })
    .catch(error => {
      utility.error(error);
    });

  // Otherwise add comment non-interactively
  } else {
    addComment(taskId, commentText, commentAuthor);
  }
};
