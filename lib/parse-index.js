const md = require('md-2-json');
const yaml = require('yamljs');
const marked = require('marked');

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
      const parsed = md.parse(data);

      // Check resulting object
      const parsedKeys = Object.keys(parsed);
      if (parsedKeys.length === 0 || parsedKeys[0] === 'raw') {
        throw new Error('data is missing a title');
      }

      // Get name
      name = parsedKeys[0];
      const index = parsed[name];

      // Get description
      description = 'raw' in index ? index.raw.trim() : '';

      // Parse options
      if ('Options' in index) {
        options = yaml.parse(index['Options'].raw.trim().replace(/```(yaml|yml)?/g, ''));
        if (
          !options ||
          Array.isArray(options) ||
          typeof options !== 'object'
        ) {
          throw new Error('options is not a valid object');
        }
      }

      // Parse columns
      const columnNames = Object.keys(index).filter(column => ['raw', 'Options'].indexOf(column) === -1);
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
    } catch (error) {
      throw new Error(`unable to parse index, ${error.message}`);
    }

    // Assemble index object
    return { name, description, options, columns };
  },

  /**
   * Convert an index object into markdown
   * @param {object} data
   * @return {string}
   */
  json2md(data) {
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

      // Add options if present
      if ('options' in data && data.options !== null) {
        if (typeof data.options !== 'object') {
          throw new Error('data.options is not an object');
        }
        if (Object.keys(data.options).length > 0) {
          result.push(
            '## Options',
            `\`\`\`yaml\n${yaml.stringify(data.options, 2, 2).trim()}\n\`\`\``
          );
        }
      }

      // Check columns
      if (!('columns' in data)) {
        throw new Error('data object is missing columns');
      }
      if (data.columns === null) {
        throw new Error('data.columns is null');
      }
      if (typeof data.columns !== 'object') {
        throw new Error('data.columns is not an object');
      }

      // Add columns
      for (let column in data.columns) {
        if (!Array.isArray(data.columns[column])) {
          throw new Error(`column "${column}" is not an array`);
        }
        result.push(
          `## ${column}`,
          data.columns[column].map((t, i) => {
            if (typeof t !== 'string') {
              throw new Error(`task ${i} in column "${column}" is not a string`);
            }
            return `- [${t}](tasks/${t}.md)`;
          }).join('\n')
        );
      }
    } catch (error) {
      throw new Error(`unable to build index, ${error.message}`);
    }

    // Filter empty lines and join into a string
    return result.filter(l => !!l).join('\n\n');
  }
};
