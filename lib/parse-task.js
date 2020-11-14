const md = require('md-2-json');
const yaml = require('yamljs');
const marked = require('marked');

function compileDescription(description, data, level) {
  if ('raw' in data) {
    description.push(data.raw.replace(/[\r\n]{3}/g, '\n\n').trim());
  }
  for (let heading in data) {
    if (['raw', 'Metadata', 'Sub-tasks', 'Relations'].indexOf(heading) !== -1) {
      continue;
    }
    description.push(`${new Array(level + 1).join('#')} ${heading}`);
    compileDescription(description, data[heading], level + 1);
  }
}

module.exports = {
  taskToJson(data) {
    let title = '', description = '', metadata = {}, subTasks = {}, relations = {};
    try {
      const parsed = md.parse(data);
      title = Object.keys(parsed)[0];
      metadata = 'Metadata' in parsed[title]
        ? yaml.parse(parsed[title]['Metadata'].raw.trim().replace(/```(yaml|yml)?/g, ''))
        : {};
      subTasks = 'Sub-tasks' in parsed[title]
        ? marked.lexer(parsed[title]['Sub-tasks'].raw)[0].items.map(item => ({
          text: item.text.trim(),
          checked: item.checked
        }))
        : [];
      relations = 'Relations' in parsed[title]
        ? marked.lexer(parsed[title]['Relations'].raw)[0].items.map(item => {
          const parts = item.tokens[0].tokens[0].text.split(' ');
          return {
            type: parts[0],
            task: parts[1]
          };
        })
        : [];
      const descriptionParts = [];
      compileDescription(descriptionParts, parsed[title], 2);
      description = descriptionParts.join('\n\n');
    } catch (error) {
      throw new Error(`Unable to parse task: ${error}`);
    }
    return { title, description, metadata, subTasks, relations };
  },

  jsonToTask(data) {
    const result = [
      `# ${data.title}`,
      data.description
    ];
    if ('metadata' in data && Object.keys(data.metadata).length > 0) {
      result.push(
        '## Metadata',
        `\`\`\`yaml\n${yaml.stringify(data.metadata, 2, 2).trim()}\n\`\`\``
      );
    }
    if ('subTasks' in data && data.subTasks.length > 0) {
      result.push(
        '## Sub-tasks',
        (data.subTasks || []).map(subTask => `- [${subTask.checked ? 'x' : ' '}] ${subTask.text}`).join('\n')
      );
    }
    if ('relations' in data && data.relations.length > 0) {
      result.push(
        '## Relations',
        (data.relations || []).map(relation => `- [${relation.type} ${relation.task}](${relation.task}.md)`).join('\n')
      );
    }
    return result.filter(l => !!l).join('\n\n');
  }
};
