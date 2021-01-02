const md = require('md-2-json');
const yaml = require('yamljs');
const marked = require('marked');
const validate = require('jsonschema').validate;

/**
 * Validate the options object
 * @param {object} options
 */
function validateOptions(options) {
  const result = validate(options, {
    type: 'object',
    properties: {
      'hiddenColumns': {
        type: 'array',
        items: { type: 'string' }
      },
      'startedColumns': {
        type: 'array',
        items: { type: 'string' }
      },
      'completedColumns': {
        type: 'array',
        items: { type: 'string' }
      },
      'sprints': {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            'start': { type: 'date' },
            'name': { type: 'string' },
            'description': { type: 'string' }
          },
          required: ['start', 'name']
        }
      },
      'defaultTaskWorkload': { type: 'number' },
      'taskWorkloadTags': {
        type: 'object',
        patternProperties: {
          '^[\w ]+$': { type: 'number' }
        }
      },
      'columnSorting': {
        type: 'object',
        patternProperties: {
          '^[\w ]+$': {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                'field': { type: 'string' },
                'filter': { type: 'string' },
                'order': {
                  type: 'string',
                  enum: [
                    'ascending',
                    'descending'
                  ]
                }
              },
              required: ['field']
            }
          }
        }
      },
      'taskTemplate': { type: 'string' },
      'dateFormat': { type: 'string' },
      'customFields': {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            'name': { type: 'string' },
            'type': {
              type: 'string',
              enum: [
                'boolean',
                'string',
                'number',
                'date'
              ]
            },
            'updateDate': {
              type: 'string',
              enum: [
                'always',
                'once',
                'none'
              ]
            }
          },
          required: ['name', 'type']
        }
      },
      'views': {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            'name': { type: 'string' },
            'columns': {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  'name': { type: 'string' },
                  'filters': { type: 'object' },
                  'sorters': {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        'field': { type: 'string' },
                        'filter': { type: 'string' },
                        'order': {
                          type: 'string',
                          enum: [
                            'ascending',
                            'descending'
                          ]
                        }
                      },
                      required: ['field']
                    }
                  }
                }
              }
            },
            'lanes': {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  'name': { type: 'string' },
                  'filters': { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate the columns object
 * @param {object} columns
 */
function validateColumns(columns) {
  const result = validate(columns, {
    type: 'object',
    patternProperties: {
      '^[\w ]+$': {
        type: 'array',
        items: { type: 'string' }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `${error.property} ${error.message}`).join('\n'));
  }
}

module.exports = {

  /**
   * Convert markdown into an index object
   * @param {string} data
   * @return {object}
   */
  md2json(data) {
    let name = '', description = '', options = {}, columns = {};
    try {

      // Check data type
      if (!data) {
        throw new Error('data is null or empty');
      }
      if (typeof data !== 'string') {
        throw new Error('data is not a string');
      }

      // Parse markdown to an object
      let parsed = null;
      try {
        parsed = md.parse(data);
      } catch (error) {
        throw new Error('invalid markdown');
      }

      // Check resulting object
      const parsedKeys = Object.keys(parsed);
      if (parsedKeys.length === 0 || parsedKeys[0] === 'raw') {
        throw new Error('data is missing a name heading');
      }

      // Get name
      name = parsedKeys[0];
      const index = parsed[name];

      // Get description
      description = 'raw' in index ? index.raw.trim() : '';

      // Parse options
      if ('Options' in index) {
        options = yaml.parse(index['Options'].raw.trim().replace(/```(yaml|yml)?/g, ''));
        validateOptions(options);
      }

      // Parse columns
      const columnNames = Object.keys(index).filter(column => ['raw', 'Options'].indexOf(column) === -1);
      if (columnNames.length) {
        columns = Object.fromEntries(columnNames.map(columnName => {
          try {
            return [
              columnName,
              'raw' in index[columnName]
                ? marked.lexer(index[columnName].raw)[0].items.map(item => item.tokens[0].tokens[0].text)
                : []
            ];
          } catch (error) {
            throw new Error(`column "${columnName}" must contain a list`);
          }
        }));
      }
    } catch (error) {
      throw new Error(`Unable to parse index: ${error.message}`);
    }

    // Assemble index object
    return { name, description, options, columns };
  },

  /**
   * Convert an index object into markdown
   * @param {object} data
   * @param {boolean} [ignoreOptions=false]
   * @return {string}
   */
  json2md(data, ignoreOptions = false) {
    const result = [];
    try {

      // Check data type
      if (!data) {
        throw new Error('data is null or empty');
      }
      if (typeof data !== 'object') {
        throw new Error('data is not an object');
      }

      // Check required fields
      if (!('name' in data)) {
        throw new Error('data object is missing name');
      }

      // Add name and description
      result.push(`# ${data.name}`);
      if ('description' in data) {
        result.push(data.description);
      }

      // Add options if present and not ignoring
      if ('options' in data && data.options !== null && !ignoreOptions) {
        validateOptions(data.options);
        if (Object.keys(data.options).length) {
          result.push(
            '## Options',
            `\`\`\`yaml\n${yaml.stringify(data.options, 4, 2).trim()}\n\`\`\``
          );
        }
      }

      // Check columns
      if (!('columns' in data)) {
        throw new Error('data object is missing columns');
      }
      validateColumns(data.columns);

      // Add columns
      for (let column in data.columns) {
        result.push(
          `## ${column}`,
          data.columns[column].map(task => `- [${task}](tasks/${task}.md)`).join('\n')
        );
      }
    } catch (error) {
      throw new Error(`Unable to build index: ${error.message}`);
    }

    // Filter empty lines and join into a string
    return `${result.filter(l => !!l).join('\n\n')}\n`;
  }
};
