const mockRequire = require('mock-require');

/**
 * A stand-in for inquirer that answers prompts from a canned object instead of from stdin.
 *
 * Rather than just returning the answers, it walks the prompt definitions the controller built:
 * `when` decides whether a question is asked, `default` supplies the answer when the test doesn't,
 * `validate` is run against the answer, and `filter` transforms it. That means the prompt
 * definitions - which is where most of the interactive code lives - are actually exercised, and a
 * validator that rejects the answer surfaces as an error rather than being silently skipped.
 */

/**
 * Resolve a prompt property that may be a value or a function of the answers so far
 * @param {*} value The property value
 * @param {object} answers The answers collected so far
 * @return {Promise<*>} The resolved value
 */
async function resolve(value, answers) {
  return typeof value === 'function' ? await value(answers) : value;
}

/**
 * Answer a list of prompts
 * @param {object[]} questions The prompt definitions
 * @param {object} responses The answer to give for each prompt name
 * @param {object} [answers={}] The answers collected so far
 * @return {Promise<object>} The collected answers
 */
async function answerQuestions(questions, responses, answers = {}) {
  for (const question of [].concat(questions)) {
    if ('when' in question && !(await resolve(question.when, answers))) {
      continue;
    }

    // Recursive prompts ask their sub-prompts once per answer in the list
    if (question.type === 'recursive') {
      const items = responses[question.name] || [];
      answers[question.name] = [];
      for (const item of items) {
        answers[question.name].push(await answerQuestions(question.prompts, item));
      }
      continue;
    }

    let value = question.name in responses
      ? responses[question.name]
      : await resolve(question.default, answers);

    if ('validate' in question) {
      const valid = await question.validate(value, answers);
      if (valid !== true) {
        throw new Error(valid);
      }
    }
    if ('filter' in question) {
      value = await question.filter(value, answers);
    }
    answers[question.name] = value;
  }
  return answers;
}

/**
 * Create a fake inquirer
 * @param {object[]} responses One response object per expected prompt() call, in order
 * @return {object} The fake inquirer, with a `questions` array recording each prompt() call
 */
function createInquirer(responses) {
  const queue = [...responses];
  const inquirer = {
    questions: [],
    registerPrompt() {},
    Separator: function Separator(line) {
      this.line = line;
    },
    async prompt(questions) {
      inquirer.questions.push([].concat(questions));
      return answerQuestions(questions, queue.shift() || {});
    }
  };
  return inquirer;
}

/**
 * Load a controller with a fake inquirer in place
 * @param {string} controllerPath The controller's path, relative to the test directory
 * @param {object[]} responses One response object per expected prompt() call, in order
 * @return {object} The loaded controller and the fake inquirer
 */
function loadController(controllerPath, responses) {
  const inquirer = createInquirer(responses);
  mockRequire('inquirer', inquirer);
  const controller = mockRequire.reRequire(controllerPath);
  return { controller, inquirer };
}

/**
 * Stop mocking inquirer and reload the controller with the real one
 * @param {string} controllerPath The controller's path, relative to the test directory
 */
function unloadController(controllerPath) {
  mockRequire.stop('inquirer');
  mockRequire.reRequire(controllerPath);
}

module.exports = {
  answerQuestions,
  createInquirer,
  loadController,
  unloadController
};
