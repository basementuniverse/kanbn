const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;
const chrono = require('chrono-node');
const yaml = require('yamljs');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

/**
 * Build search filters interactively
 */
async function interactiveFind(showFullResults = true) {
  return await inquirer.prompt([
    {
      type: 'confirm',
      name: 'nonquiet',
      message: 'Show full task details in results?',
      default: showFullResults
    },
    {
      type: 'recursive',
      name: 'filters',
      initialMessage: 'Add a filter?',
      message: 'Add another filter?',
      default: false,
      prompts: [
        {
          type: 'rawlist',
          name: 'type',
          message: 'Filter type:',
          default: 'Id',
          choices: [
            'Id',
            'Name',
            'Description',
            'Column',
            'Created',
            'Updated',
            'Completed',
            'Due',
            'Sub-tasks',
            'Count sub-tasks',
            'Tags',
            'Count tags',
            'Relations',
            'Count relations',
            new inquirer.Separator(),
            'None'
          ]
        },
        {
          type: 'input',
          name: 'value',
          message: 'Filter value:',
          default: '',
          when: answers => [
            'Id',
            'Name',
            'Description',
            'Sub-tasks',
            'Tags',
            'Relations'
          ].indexOf(answers.type) !== -1,
          validate: async value => {
            if (!value) {
              return 'Filter value cannot be empty';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'value',
          message: 'Filter value:',
          default: '',
          when: answers => [
            'Created',
            'Updated',
            'Completed',
            'Due'
          ].indexOf(answers.type) !== -1,
          validate: async value => {
            if (!value) {
              return 'Filter value cannot be empty';
            }
            if (chrono.parseDate(value) === null) {
              return 'Unable to parse date';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'value',
          message: 'Filter value:',
          default: '',
          when: answers => [
            'Count sub-tasks',
            'Count tags',
            'Count relations'
          ].indexOf(answers.type) !== -1,
          validate: async value => {
            if (!value) {
              return 'Filter value cannot be empty';
            }
            if (isNaN(value)) {
              return 'Filter value must be numeric';
            }
            return true;
          }
        }
      ]
    }
  ]);
}

/**
 * Search tasks
 * @param {object} taskData
 * @param {string} columnName
 */
function findTasks(filters, quiet) {
  const removeEmptyProperties = o => Object.fromEntries(Object.entries(o).filter(
    ([k, v]) => !(Array.isArray(v) && v.length == 0) && !!v
  ));
  const spinner = new Spinner('Finding tasks...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .search(filters, quiet)
  .then(results => {
    spinner.stop(true);
    if (quiet) {
      console.log(results.join('\n'));
    } else {
      console.log(`Found ${results.length} task${results.length === 1 ? '' : 's'}`);
      if (results.length > 0) {
        console.log('---');
      }
      const processedResults = results.map(async result => ({
        id: result.id,
        name: result.name,
        column: await kanbn.findTaskColumn(result.id),
        metadata: result.metadata,
        relations: result.relations
      }));
      Promise.all(processedResults).then(outputResults => console.log(
        outputResults.map(outputResult => yaml.stringify(removeEmptyProperties(outputResult))).join('\n---\n')
      ));
    }
  })
  .catch(error => {
    spinner.stop(true);
    utility.showError(error);
  });
}

/**
 * Add a filter to the filters object without over-writing any existing filters
 * @param {object} filters The current filter object
 * @param {string} filterName The property name for the filter
 * @param {string} filterValue The filter value
 */
function addFilterValue(filters, filterName, filterValue) {
  if (filters[filterName]) {
    if (Array.isArray(filters[filterName])) {
      filters[filterName].push(filterValue);
    } else {
      filters[filterName] = [filters[filterName], filterValue];
    }
  } else {
    filters[filterName] = filterValue;
  }
}

const filterPropertyNames = {
  'Id': 'id',
  'Name': 'name',
  'Description': 'description',
  'Column': 'column',
  'Created': 'created',
  'Updated': 'updated',
  'Completed': 'completed',
  'Due': 'due',
  'Sub-tasks': 'sub-task',
  'Count sub-tasks': 'count-sub-tasks',
  'Tags': 'tag',
  'Count tags': 'count-tags',
  'Relations': 'relation',
  'Count relations': 'count-relations'
};

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    console.error(utility.replaceTags('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}'));
    return;
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.showError(error);
    return;
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    console.error(utility.replaceTags('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}'));
    return;
  }

  // Get filters from args
  const filters = {};
  for (let filterProperty of Object.values(filterPropertyNames)) {
    if (args[filterProperty]) {
      filters[filterProperty] = args[filterProperty];
    }
  }

  // Build search filters interactively
  if (args.interactive) {
    interactiveFind(!args.quiet)
    .then(answers => {
      for (let filter of answers.filters) {
        addFilterValue(filters, filterPropertyNames[filter.type], filter.value);
      }
      findTasks(filters, !answers.nonquiet);
    })
    .catch(error => {
      utility.showError(error);
    });

  // Otherwise create task non-interactively
  } else {
    findTasks(filters, args.quiet);
  }
};
