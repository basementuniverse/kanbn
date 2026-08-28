const yaml = require('yamljs');
const fm = require('front-matter');
const marked = require('marked');
const validate = require('jsonschema').validate;
const parseMarkdown = require('./parse-markdown');

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
      'startedField': { type: 'string' },
      'completedField': { type: 'string' },
      'verbose': { type: 'boolean' },
      'defaultBoard': { type: 'string' },
      'boards': {
        type: 'object',
        properties: {
          'exclude': {
            type: 'array',
            items: { type: 'string' }
          },
          'order': {
            type: 'array',
            items: { type: 'string' }
          }
        }
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
            'filters': { type: 'object' },
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
                },
                required: ['name']
              },
              minItems: 1
            },
            'lanes': {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  'name': { type: 'string' },
                  'filters': { type: 'object' }
                },
                required: ['name']
              }
            }
          },
          required: ['name']
        }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Get the task id from a column list item, or null if the item isn't a task link
 *
 * A task link is a list item that begins with a markdown link, e.g. `- [task-id](tasks/task-id.md)`.
 * Anything else - a bare title, a checkbox item, a note - is content that this file preserves but
 * doesn't interpret
 * @param {object} item A list item token
 * @return {?string} The task id, or null if this item isn't a task link
 */
function taskIdFromListItem(item) {
  const block = item.tokens && item.tokens[0];
  const inline = block && block.tokens && block.tokens[0];
  return inline && inline.type === 'link' ? inline.text : null;
}

/**
 * Remove trailing whitespace from a markdown token's raw source, keeping any internal line breaks so
 * that multi-line items survive a read/write cycle intact
 * @param {string} raw
 * @return {string}
 */
function trimRaw(raw) {
  return String(raw).replace(/\s+$/, '');
}

/**
 * Split a column's markdown into the task ids it references and everything else it contains
 *
 * Every top-level token is considered, not just the first list: a single line using a different
 * bullet character splits one list into several, and reading only the first one silently dropped
 * every task after it. Content that isn't a task link is recorded with the position it occupied so
 * that it can be written back where the user put it
 * @param {string} markdown The column's markdown content
 * @return {{taskIds: string[], content: object[]}}
 */
function parseColumnContent(markdown) {
  const taskIds = [], content = [];
  if (!markdown) {
    return { taskIds, content };
  }
  let position = 0;
  for (const token of marked.lexer(markdown)) {
    if (token.type === 'space') {
      continue;
    }
    if (token.type === 'list') {
      for (const item of token.items) {
        const taskId = taskIdFromListItem(item);
        if (taskId === null) {
          content.push({ position, text: item.text.trim(), raw: trimRaw(item.raw) });
        } else {
          taskIds.push(taskId);
        }
        position++;
      }
      continue;
    }

    // A paragraph, quote, code block or anything else that isn't a list is content as well. It's
    // written back surrounded by blank lines so that it doesn't merge into a neighbouring list
    content.push({
      position,
      text: ('text' in token ? String(token.text) : trimRaw(token.raw)).trim(),
      raw: trimRaw(token.raw),
      block: true
    });
    position++;
  }
  return { taskIds, content };
}

/**
 * Rebuild a column's markdown from its task ids and preserved content
 * @param {string[]} taskIds
 * @param {object[]} content
 * @return {string} The column's markdown content
 */
function buildColumnContent(taskIds, content) {
  const lines = taskIds.map(taskId => `- [${taskId}](tasks/${taskId}.md)`);

  // Positions were recorded against the column as it was read. Tasks move, so a position can end up
  // past the end of the column - clamping keeps the line in the column it was written in
  for (const entry of [...content].sort((a, b) => a.position - b.position)) {
    lines.splice(
      Math.min(entry.position, lines.length),
      0,
      entry.block ? `\n${entry.raw}\n` : entry.raw
    );
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Validate the preserved column content object
 * @param {object} columnContent
 */
function validateColumnContent(columnContent) {
  const result = validate(columnContent, {
    type: 'object',
    patternProperties: {
      '^[\w ]+$': {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            'position': { type: 'number' },
            'text': { type: 'string' },
            'raw': { type: 'string' },
            'block': { type: 'boolean' }
          },
          required: ['position', 'raw']
        }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `${error.property} ${error.message}`).join('\n'));
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
    let name = '', description = '', options = {}, columns = {}, columnContent = {};
    try {

      // Check data type
      if (!data) {
        throw new Error('data is null or empty');
      }
      if (typeof data !== 'string') {
        throw new Error('data is not a string');
      }

      // Get YAML front matter if any exists
      if (fm.test(data)) {
        ({ attributes: options, body: data } = fm(data));

        // Make sure the front matter contains an object
        if (typeof options !== 'object') {
          throw new Error('invalid front matter content');
        }
      }

      // Parse markdown to an object
      let index = null;
      try {
        index = parseMarkdown(data);
      } catch (error) {
        throw new Error(`invalid markdown (${error.message})`);
      }

      // Check resulting object
      const indexHeadings = Object.keys(index);
      if (indexHeadings.length === 0 || indexHeadings[0] === 'raw') {
        throw new Error('data is missing a name heading');
      }

      // Get name
      name = indexHeadings[0];

      // Get description
      description = name in index ? index[name].content.trim() : '';

      // Parse options
      // Options will be serialized back to front-matter, this check remains here for backwards-compatibility
      if ('Options' in index) {

        // Get embedded options and make sure it's an object
        const embeddedOptions = yaml.parse(index['Options'].content.trim().replace(/```(yaml|yml)?/g, ''));
        if (typeof embeddedOptions !== 'object') {
          throw new Error('invalid options content');
        }

        // Merge with front matter options
        options = Object.assign(options, embeddedOptions);
      }
      validateOptions(options);

      // Parse columns
      const columnNames = Object.keys(index).filter(column => ['raw', 'Options', name].indexOf(column) === -1);
      for (const columnName of columnNames) {
        let parsed = null;
        try {
          parsed = parseColumnContent(index[columnName].content);
        } catch (error) {
          throw new Error(`unable to parse column "${columnName}" (${error.message})`);
        }
        columns[columnName] = parsed.taskIds;

        // Anything in the column that isn't a task link is kept verbatim rather than rejected, so
        // that a hand-written note or a mistyped link is preserved instead of being thrown away the
        // next time the board is saved. Nothing else in kanbn reads it
        if (parsed.content.length) {
          columnContent[columnName] = parsed.content;
        }
      }
    } catch (error) {
      throw new Error(`Unable to parse index: ${error.message}`);
    }

    // Assemble index object
    const result = { name, description, options, columns };
    if (Object.keys(columnContent).length) {
      result.columnContent = columnContent;
    }
    return result;
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

      // Add options as front-matter content if present and not ignoring
      if ('options' in data && data.options !== null && !ignoreOptions) {
        validateOptions(data.options);
        if (Object.keys(data.options).length) {
          result.push(
            `---\n${yaml.stringify(data.options, 4, 2).trim()}\n---`
          );
        }
      }

      // Add name and description
      result.push(`# ${data.name}`);
      if ('description' in data) {
        result.push(data.description);
      }

      // Check columns
      if (!('columns' in data)) {
        throw new Error('data object is missing columns');
      }
      validateColumns(data.columns);

      // Add columns, putting any preserved non-task content back where it was found
      const columnContent = 'columnContent' in data && data.columnContent !== null ? data.columnContent : {};
      validateColumnContent(columnContent);
      for (let column in data.columns) {
        result.push(
          `## ${column}`,
          buildColumnContent(data.columns[column], column in columnContent ? columnContent[column] : [])
        );
      }
    } catch (error) {
      throw new Error(`Unable to build index: ${error.message}`);
    }

    // Filter empty lines and join into a string
    return `${result.filter(l => !!l).join('\n\n')}\n`;
  }
};
