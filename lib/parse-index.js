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
    let title = '', description = '', options = {}, columns = {};
    try {
      const parsed = md.parse(data);
      title = Object.keys(parsed)[0];
      description = 'raw' in parsed[title] ? parsed[title].raw.trim() : '';
      options = 'Options' in parsed[title]
        ? yaml.parse(parsed[title]['Options'].raw.trim().replace(/```(yaml|yml)?/g, ''))
        : {};
      const columnNames = Object.keys(parsed[title]).filter(column => ['raw', 'Options'].indexOf(column) === -1);
      columns = Object.fromEntries(columnNames.map(columnName => [
        columnName,
        'raw' in parsed[title][columnName]
          ? marked.lexer(parsed[title][columnName].raw)[0].items.map(item => item.tokens[0].tokens[0].text)
          : []
      ]));
    } catch (error) {
      throw new Error(`Unable to parse index: ${error}`);
    }
    return { title, description, options, columns };
  },

  /**
   * Convert an index object into markdown
   * @param {object} data
   * @return {string}
   */
  json2md(data) {
    const result = [
      `# ${data.title}`,
      data.description
    ];
    if (Object.keys(data.options).length > 0) {
      result.push(
        '## Options',
        `\`\`\`yaml\n${yaml.stringify(data.options, 2, 2).trim()}\n\`\`\``
      );
    }
    for (let column in data.columns) {
      result.push(
        `## ${column}`,
        data.columns[column].map(t => `- [${t}](tasks/${t}.md)`).join('\n')
      );
    }
    return result.filter(l => !!l).join('\n\n');
  }
};