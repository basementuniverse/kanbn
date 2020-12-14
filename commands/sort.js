const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;

inquirer.registerPrompt('recursive', require('inquirer-recursive'));

const sorterFields = [
  {
    name: 'Id',
    field: 'id',
    options: [
      '--id'
    ],
    filterable: true
  },
  {
    name: 'Name',
    field: 'name',
    options: [
      '--name',
      '-n'
    ],
    filterable: true
  },
  {
    name: 'Description',
    field: 'description',
    options: [
      '--desc',
      '-d'
    ],
    filterable: true
  },
  {
    name: 'Sub-tasks',
    field: 'subTasks',
    options: [
      '--sub-task',
      '-s'
    ],
    filterable: true
  },
  {
    name: 'Count sub-tasks',
    field: 'countSubTasks',
    options: [
      '--count-sub-tasks'
    ],
    filterable: false
  },
  {
    name: 'Tags',
    field: 'tags',
    options: [
      '--tag',
      '-t'
    ],
    filterable: true
  },
  {
    name: 'Count tags',
    field: 'countTags',
    options: [
      '--count-tags'
    ],
    filterable: false
  },
  {
    name: 'Relations',
    field: 'relations',
    options: [
      '--relation',
      '-r'
    ],
    filterable: true
  },
  {
    name: 'Count relations',
    field: 'countRelations',
    options: [
      '--count-relations'
    ],
    filterable: false
  },
  {
    name: 'Created date',
    field: 'created',
    options: [
      '--created'
    ],
    filterable: false
  },
  {
    name: 'Updated date',
    field: 'updated',
    options: [
      '--updated'
    ],
    filterable: false
  },
  {
    name: 'Started date',
    field: 'started',
    options: [
      '--started'
    ],
    filterable: false
  },
  {
    name: 'Completed date',
    field: 'completed',
    options: [
      '--completed'
    ],
    filterable: false
  },
  {
    name: 'Due date',
    field: 'due',
    options: [
      '--due'
    ],
    filterable: false
  },
  {
    name: 'Workload',
    field: 'workload',
    options: [
      '--workload',
      '-w'
    ],
    filterable: false
  }
];

/**
 * Sort a column interactively
 * @param {string} columnName
 * @param {string[]} columnNames
 * @param {object[]} sorters
 * @return {Promise<any>}
 */
async function interactive(columnName, columnNames, sorters) {
  const sorterNameToField = Object.fromEntries(sorterFields.map(sorterField => [sorterField.name, sorterField.field]));
  return await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'column',
      message: 'Which column do you want to sort?',
      default: columnName,
      choices: columnNames
    },
    {
      type: 'recursive',
      name: 'sorters',
      message: 'Sort by another field?',
      default: true,
      autoStart: !sorters.length,
      prompts: [
        {
          type: 'list',
          name: 'field',
          message: 'Field:',
          default: 'Name',
          choices: sorterFields.map(sorterField => sorterField.name),
          filter: (value, answers) => sorterNameToField[value]
        },
        {
          type: 'confirm',
          name: 'addFilter',
          message: 'Filter this field?',
          default: false,
          when: answers => (
            sorterFields
            .filter(sorterField => sorterField.filterable)
            .map(sorterField => sorterField.field)
            .indexOf(answers.field) !== -1
          )
        },
        {
          type: 'input',
          name: 'filter',
          message: 'Filter field:',
          when: answers => answers.addFilter,
          validate: value => {
            if (!value) {
              return 'Filter cannot be empty';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'order',
          message: 'Which order?',
          default: 'Ascending',
          choices: [
            'Ascending',
            'Descending'
          ],
          filter: (value, answers) => ({
            'Ascending': 'ascending',
            'Descending': 'descending'
          })[value]
        }
      ]
    }
  ]);
}

/**
 * Sort a column
 * @param {string} columnName
 * @param {object[]} sorters
 * @param {boolean} save
 */
function sortColumn(columnName, sorters, save) {
  const spinner = new Spinner('Sorting column...');
  spinner.setSpinnerString(18);
  spinner.start();
  kanbn
  .sort(columnName, sorters, save)
  .then(() => {
    spinner.stop(true);
    console.log(`Column "${columnName}" sorted`);
  })
  .catch(error => {
    spinner.stop(true);
    utility.error(error, true);
  });
}

module.exports = async (args, argv) => {

  // Sortable fields and aliases
  const sortOptions = Object.fromEntries(utility.zip(
    sorterFields.map(sorterField => sorterField.options).flat(),
    sorterFields.map(sorterField => (new Array(sorterField.options.length)).fill(sorterField.field)).flat()
  ));

  // Sorting order and aliases
  const orderOptions = {
    '--ascending': 'ascending',
    '-a': 'ascending',
    '--descending': 'descending',
    '-z': 'descending'
  };

  // Skip these options
  const skipOptions = [
    '--interactive',
    '-i',
    '--save'
  ];

  // Get the column that we're sorting
  const columnName = args._.length > 1 ? args._[1] : null;

  // Column name must be defined if not sorting interactively
  if (columnName === null && !args.interactive) {
    utility.error('No column name specified\nTry running {b}kanbn sort "column"{b} or {b}kanbn sort -i{b}', true);
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

  // If a column name is defined, make sure it exists in the index
  if (columnName !== null) {
    if (columnNames.indexOf(columnName) === -1) {
      utility.error(`Column "${columnName}" doesn't exist`, true);
    }
    argv.shift();
  }

  // Get the default sorting order
  let defaultOrder = "ascending";
  if (argv[0] in orderOptions) {
    defaultOrder = orderOptions[argv[0]];
    argv.shift();
  }

  // Create a list of fields to sort by
  const sorters = [];
  let currentSorter = null, expectingFilter = false;
  for (let arg of argv) {
    if (skipOptions.indexOf(arg) !== -1) {
      continue;
    }
    if (arg in sortOptions) {
      if (currentSorter !== null) {
        sorters.push(currentSorter);
      }
      currentSorter = {
        field: sortOptions[arg],
        filter: '',
        order: defaultOrder
      };
      expectingFilter = true;
    } else if (currentSorter && currentSorter.field) {
      if (arg in orderOptions) {
        currentSorter.order = orderOptions[arg];
        expectingFilter = false;
      }
      if (expectingFilter) {
        currentSorter.filter = arg;
        expectingFilter = false;
      }
    }
  }
  if (currentSorter && currentSorter.field) {
    sorters.push(currentSorter);
  }

  // Build sorters interactively
  if (args.interactive) {
    interactive(columnName, columnNames, sorters)
    .then(answers => {
      inquirer
      .prompt({
        type: 'confirm',
        name: 'save',
        message: 'Save sort settings?',
        default: args.save
      })
      .then(saveAnswer => {
        sortColumn(answers.column, answers.sorters, saveAnswer.save);
      })
      .catch(error => {
        utility.error(error, true);
      });
    })
    .catch(error => {
      utility.error(error, true);
    });

  // Otherwise sort a column non-interactively
  } else {
    sortColumn(columnName, sorters, args.save);
  }
};
