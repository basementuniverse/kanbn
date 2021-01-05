const kanbn = require('../main');
const utility = require('../utility');
const inquirer = require('inquirer');
const chrono = require('chrono-node');
const yaml = require('yamljs');

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

const searchFields = [
  {
    name: 'Id',
    field: 'id',
    type: 'string'
  },
  {
    name: 'Name',
    field: 'name',
    type: 'string'
  },
  {
    name: 'Description',
    field: 'description',
    type: 'string'
  },
  {
    name: 'Column',
    field: 'column',
    type: 'string'
  },
  {
    name: 'Created',
    field: 'created',
    type: 'date'
  },
  {
    name: 'Updated',
    field: 'updated',
    type: 'date'
  },
  {
    name: 'Completed',
    field: 'completed',
    type: 'date'
  },
  {
    name: 'Due',
    field: 'due',
    type: 'date'
  },
  {
    name: 'Sub-tasks',
    field: 'sub-task',
    type: 'string'
  },
  {
    name: 'Count sub-tasks',
    field: 'count-sub-tasks',
    type: 'number'
  },
  {
    name: 'Tags',
    field: 'tag',
    type: 'string'
  },
  {
    name: 'Count tags',
    field: 'count-tags',
    type: 'number'
  },
  {
    name: 'Relations',
    field: 'relation',
    type: 'string'
  },
  {
    name: 'Count relations',
    field: 'count-relations',
    type: 'number'
  },
  {
    name: 'Comments',
    field: 'comment',
    type: 'string'
  },
  {
    name: 'Count comments',
    field: 'count-comments',
    type: 'number'
  },
  {
    name: 'Assigned',
    field: 'assigned',
    type: 'string'
  }
];

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
          default: searchFields[0].name,
          choices: [
            ...searchFields.map(s => s.name),
            new inquirer.Separator(),
            'None'
          ]
        },
        {
          type: 'input',
          name: 'value',
          message: 'Filter value:',
          default: '',
          when: answers => searchFields
            .filter(s => s.type === 'string')
            .map(s => s.name)
            .indexOf(answers.type) !== -1,
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
          when: answers => searchFields
            .filter(s => s.type === 'date')
            .map(s => s.name)
            .indexOf(answers.type) !== -1,
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
          when: answers => searchFields
            .filter(s => s.type === 'number')
            .map(s => s.name)
            .indexOf(answers.type) !== -1,
          validate: async value => {
            if (!value) {
              return 'Filter value cannot be empty';
            }
            if (isNaN(value)) {
              return 'Filter value must be numeric';
            }
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'value',
          message: 'Filter value:',
          default: true,
          when: answers => searchFields
            .filter(s => s.type === 'boolean')
            .map(s => s.name)
            .indexOf(answers.type) !== -1
        }
      ]
    }
  ]);
}

/**
 * Search tasks
 * @param {object} filters
 * @param {boolean} quiet
 * @param {boolean} json
 */
function findTasks(filters, quiet, json) {
  const removeEmptyProperties = o => Object.fromEntries(Object.entries(o).filter(
    ([k, v]) => !(Array.isArray(v) && v.length == 0) && !!v
  ));
  kanbn
  .search(filters, quiet)
  .then(results => {
    if (quiet) {
      console.log(json ? JSON.stringify(results, null, 2) : results.join('\n'));
    } else {
      if (json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`Found ${results.length} task${results.length === 1 ? '' : 's'}`);
        if (results.length > 0) {
          console.log('---');
        }
        console.log(results.map(result => yaml.stringify(removeEmptyProperties(result), 4, 2).trim()).join('\n---\n'));
      }
    }
  })
  .catch(error => {
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

  // Add custom fields to search fields
  if ('customFields' in index.options) {
    for (let customField of index.options.customFields) {
      searchFields.push({
        name: customField.name,
        field: customField.name,
        type: customField.type
      });
    }
  }

  // Get filters from args
  const filters = {};
  for (let filterProperty of searchFields.map(s => s.field)) {
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
  if ('count-comments' in filters) {
    if (!convertNumericFilters(filters, 'count-comments')) {
      utility.error('Count comments filter value must be numeric', true);
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

  // Check and add custom field filters
  if ('customFields' in index.options) {
    for (let customField of index.options.customFields) {
      if (customField.name in args) {
        filters[customField.name] = args[customField.name];
        switch (customField.type) {
          case 'boolean':
            if (typeof filters[customField.name] !== 'boolean') {
              utility.error(`Custom field "${customField.name}" value is not a boolean`, true);
            }
            break;
          case 'number':
            if (!convertNumericFilters(filters, customField.name)) {
              utility.error(`Custom field "${customField.name}" value is not a number`, true);
            }
            break;
          case 'date':
            if (!convertDateFilters(filters, customField.name)) {
              utility.error(`Unable to parse date for custom field "${customField.name}"`, true);
            }
            break;
          default: break;
        }
      }
    }
  }

  // Build search filters interactively
  if (args.interactive) {
    interactive()
    .then(answers => {
      inquirer
      .prompt([
        {
          type: 'confirm',
          name: 'nonquiet',
          message: 'Show full task details in results?',
          default: !args.quiet
        },
        {
          type: 'confirm',
          name: 'json',
          message: 'Show results in JSON format?',
          default: !!args.json
        }
      ])
      .then(otherAnswers => {
        for (let filter of answers.filters) {
          addFilterValue(
            filters,
            searchFields.find(s => s.name === filter.type).field,
            filter.value
          );
        }
        findTasks(filters, !otherAnswers.nonquiet, otherAnswers.json);
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
    findTasks(filters, args.quiet, args.json);
  }
};
