const kanbn = require('../src/main');
const utility = require('../src/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;
const chrono = require('chrono-node');
const yaml = require('yamljs');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

/**
 * Build search filters interactively
 * @return {Promise<any>}
 */
async function interactive() {
  return await inquirer.prompt([
    {
      type: 'recursive',
      name: 'filters',
      initialMessage: 'Add a filter?',
      message: 'Add another filter?',
      default: true,
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
 * @param {object} filters
 * @param {boolean} quiet
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
        outputResults.map(outputResult => yaml.stringify(removeEmptyProperties(outputResult), 4, 2)).join('\n---\n')
      ));
    }
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
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

/**
 * Convert a filter or array of filters to numeric values
 * @param {object} filters The current filter object
 * @param {string} filterName The property name for the filter
 * @return {boolean} True if all values could be converted
 */
function convertNumericFilters(filters, filterName) {
  if (Array.isArray(filters[filterName])) {
    for (let i = 0; i < filters[filterName].length; i++) {
      const numericValue = parseInt(filters[filterName][i]);
      if (isNaN(numericValue)) {
        return false;
      }
      filters[filterName][i] = numericValue;
    }
  } else {
    const numericValue = parseInt(filters[filterName]);
    if (isNaN(numericValue)) {
      return false;
    }
    filters[filterName] = numericValue;
  }
  return true;
}

/**
 * Convert a filter or array of filters to date values
 * @param {object} filters The current filter object
 * @param {string} filterName The property name for the filter
 * @return {boolean} True if all values could be converted
 */
function convertDateFilters(filters, filterName) {
  if (Array.isArray(filters[filterName])) {
    for (let i = 0; i < filters[filterName].length; i++) {
      const dateValue = chrono.parseDate(filters[filterName][i]);
      if (dateValue === null) {
        return false;
      }
      filters[filterName][i] = dateValue;
    }
  } else {
    const dateValue = chrono.parseDate(filters[filterName]);
    if (dateValue === null) {
      return false;
    }
    filters[filterName] = dateValue;
  }
  return true;
}

/**
 * Filter names from interactive prompt mapped to property names in the filters object
 */
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
  'Count relations': 'count-relations',
  'Assigned user': 'assigned'
};

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error, true);
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    utility.error('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}', true);
  }

  // Get filters from args
  const filters = {};
  for (let filterProperty of Object.values(filterPropertyNames)) {
    if (args[filterProperty]) {
      filters[filterProperty] = args[filterProperty];
    }
  }

  // Check and convert numeric filters
  if ('count-sub-tasks' in filters) {
    if (!convertNumericFilters(filters, 'count-sub-tasks')) {
      utility.error('Count sub-tasks filter value must be numeric', true);
    }
  }
  if ('count-tags' in filters) {
    if (!convertNumericFilters(filters, 'count-tags')) {
      utility.error('Count tags filter value must be numeric', true);
    }
  }
  if ('count-relations' in filters) {
    if (!convertNumericFilters(filters, 'count-relations')) {
      utility.error('Count relations filter value must be numeric', true);
    }
  }

  // Check date filters
  if ('created' in filters) {
    if (!convertDateFilters(filters, 'created')) {
      utility.error('Unable to parse created date', true);
    }
  }
  if ('updated' in filters) {
    if (!convertDateFilters(filters, 'updated')) {
      utility.error('Unable to parse updated date', true);
    }
  }
  if ('completed' in filters) {
    if (!convertDateFilters(filters, 'completed')) {
      utility.error('Unable to parse completed date', true);
    }
  }
  if ('due' in filters) {
    if (!convertDateFilters(filters, 'due')) {
      utility.error('Unable to parse due date', true);
    }
  }

  // Build search filters interactively
  if (args.interactive) {
    interactive()
    .then(answers => {
      inquirer
      .prompt({
        type: 'confirm',
        name: 'nonquiet',
        message: 'Show full task details in results?',
        default: !args.quiet
      })
      .then(nonQuietAnswer => {
        for (let filter of answers.filters) {
          addFilterValue(filters, filterPropertyNames[filter.type], filter.value);
        }
        findTasks(filters, !nonQuietAnswer.nonquiet);
      })
      .catch(error => {
        utility.error(error, true);
      });
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise create task non-interactively
  } else {
    findTasks(filters, args.quiet);
  }
};
