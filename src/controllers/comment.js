const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');
const getGitUsername = require('git-user-name');

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
  })
  .catch(error => {
    utility.error(error, true);
  });
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the task that we're add a comment to
  const taskId = args._[1];
  if (!taskId) {
    utility.error('No task id specified\nTry running {b}kanbn comment "task id"{b}', true);
  }

  // Make sure the task exists
  try {
    await kanbn.taskExists(taskId);
  } catch (error) {
    utility.error(error, true);
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
    commentAuthor = getGitUsername();
  }

  // Add comment interactively
  if (args.interactive) {
    interactive(commentText, commentAuthor)
    .then(answers => {
      addComment(taskId, answers.text, answers.author);
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise add comment non-interactively
  } else {
    addComment(taskId, commentText, commentAuthor);
  }
};
