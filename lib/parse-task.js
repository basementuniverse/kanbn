const md = require('md-2-json');
const yaml = require('yamljs');
const marked = require('marked');
const utility = require('./utility');

/**
 * Recursively construct a description string from different levels of headings in the data object
 * @param {string[]} description
 * @param {object} data
 * @param {number} level
 */
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

  /**
   * Convert markdown into a task object
   * @param {string} data
   * @return {object}
   */
  md2json(data) {
    let id = '', name = '', description = '', metadata = {}, subTasks = [], relations = [];
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
        throw new Error('data is missing a name heading');
      }

      // Get name
      name = parsedKeys[0];
      const task = parsed[name];

      // Get id from name
      id = utility.getTaskId(name);

      // Parse metadata
      if ('Metadata' in task) {
        metadata = yaml.parse(task['Metadata'].raw.trim().replace(/```(yaml|yml)?/g, ''));
        if (
          !metadata ||
          Array.isArray(metadata) ||
          typeof metadata !== 'object'
        ) {
          throw new Error('metadata is not a valid object');
        }
      }

      // Parse sub-tasks
      if ('Sub-tasks' in task) {
        try {
          subTasks = marked.lexer(task['Sub-tasks'].raw)[0].items.map(item => ({
            text: item.text.trim(),
            completed: item.checked || false
          }));
        } catch (error) {
          throw new Error('Sub-tasks must contain a list');
        }
      }

      // Parse relations
      if ('Relations' in task) {
        try {
          relations = marked.lexer(task['Relations'].raw)[0].items.map(item => {
            const parts = item.tokens[0].tokens[0].text.split(' ');
            return parts.length === 1
              ? {
                task: parts[0].trim(),
                type: ''
              }
              : {
                task: parts.pop().trim(),
                type: parts.join(' ').trim()
              };
          });
        } catch (error) {
          throw new Error('Relations must contain a list');
        }
      }

      // Assemble description
      const descriptionParts = [];
      compileDescription(descriptionParts, task, 2);
      description = descriptionParts.join('\n\n');
    } catch (error) {
      throw new Error(`Unable to parse task: ${error.message}`);
    }

    // Assemble task object
    return { id, name, description, metadata, subTasks, relations };
  },

  /**
   * Convert a task object into markdown
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

      // Add metadata if present
      if ('metadata' in data && data.metadata !== null) {
        if (typeof data.metadata !== 'object') {
          throw new Error('data.metadata is not an object');
        }
        if (Object.keys(data.metadata).length > 0) {
          result.push(
            '## Metadata',
            `\`\`\`yaml\n${yaml.stringify(data.metadata, 2, 2).trim()}\n\`\`\``
          );
        }
      }

      // Add sub-tasks if present
      if ('subTasks' in data && data.subTasks !== null) {
        if (!Array.isArray(data.subTasks)) {
          throw new Error('data.subTasks is not an array');
        }
        if (data.subTasks.length > 0) {
          result.push(
            '## Sub-tasks',
            data.subTasks.map((subTask, i) => {
              if (subTask === null) {
                throw new Error(`subTask ${i} is null`);
              }
              if (typeof subTask !== 'object') {
                throw new Error(`subTask ${i} is not an object`);
              }
              if (!('completed' in subTask)) {
                throw new Error(`subTask ${i} is missing completed`);
              }
              if (typeof subTask.completed !== 'boolean') {
                throw new Error(`subTask[${i}].completed must be a boolean`);
              }
              if (!('text' in subTask)) {
                throw new Error(`subTask ${i} is missing text`);
              }
              if (typeof subTask.text !== 'string') {
                throw new Error(`subTask[${i}].text must be a string`);
              }
              return `- [${subTask.completed ? 'x' : ' '}] ${subTask.text}`;
            }).join('\n')
          );
        }
      }

      // Add relations if present
      if ('relations' in data && data.relations !== null) {
        if (!Array.isArray(data.relations)) {
          throw new Error('data.relations is not an array');
        }
        if (data.relations.length > 0) {
          result.push(
            '## Relations',
            data.relations.map((relation, i) => {
              if (relation === null) {
                throw new Error(`relation ${i} is null`);
              }
              if (typeof relation !== 'object') {
                throw new Error(`relation ${i} is not an object`);
              }
              if (!('type' in relation)) {
                throw new Error(`relation ${i} is missing type`);
              }
              if (typeof relation.type !== 'string') {
                throw new Error(`relation[${i}].type must be a string`);
              }
              if (!('task' in relation)) {
                throw new Error(`relation ${i} is missing task`);
              }
              if (typeof relation.task !== 'string') {
                throw new Error(`relation[${i}].task must be a string`);
              }
              return `- [${relation.type ? `${relation.type} ` : ''}${relation.task}](${relation.task}.md)`;
            }).join('\n')
          );
        }
      }
    } catch (error) {
      throw new Error(`Unable to build task: ${error.message}`);
    }

    // Filter empty lines and join into a string
    return result.filter(l => !!l).join('\n\n');
  }
};
