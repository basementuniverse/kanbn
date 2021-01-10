const md = require('md-2-json');
const yaml = require('yamljs');
const marked = require('marked');
const utility = require('./utility');
const chrono = require('chrono-node');
const validate = require('jsonschema').validate;

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
    if (['raw', 'Metadata', 'Sub-tasks', 'Relations', 'Comments'].indexOf(heading) !== -1) {
      continue;
    }
    description.push(`${new Array(level + 1).join('#')} ${heading}`);
    compileDescription(description, data[heading], level + 1);
  }
}

/**
 * Validate the metadata object converted from Markdown
 * @param {object} metadata
 */
function validateMetadataFromMarkdown(metadata) {
  const result = validate(metadata, {
    type: 'object',
    properties: {
      'created': {
        oneOf: [
          { type: 'string' },
          { type: 'date'}
        ]
      },
      'updated': {
        oneOf: [
          { type: 'string' },
          { type: 'date'}
        ]
      },
      'started': {
        oneOf: [
          { type: 'string' },
          { type: 'date'}
        ]
      },
      'completed': {
        oneOf: [
          { type: 'string' },
          { type: 'date'}
        ]
      },
      'due': {
        oneOf: [
          { type: 'string' },
          { type: 'date'}
        ]
      },
      'progress': {
        type: 'number'
      },
      'tags': {
        type: 'array',
        items: { type: 'string' }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate the metadata object converted from JSON
 * @param {object} metadata
 */
function validateMetadataFromJSON(metadata) {
  const result = validate(metadata, {
    type: 'object',
    properties: {
      'created': { type: 'date'},
      'updated': { type: 'date'},
      'started': { type: 'date'},
      'completed': { type: 'date'},
      'due': { type: 'date'},
      'progress': { type: 'number' },
      'tags': {
        type: 'array',
        items: { type: 'string' }
      },
      'assigned': { type: 'string' }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate the sub-tasks object
 * @param {object} subTasks
 */
function validateSubTasks(subTasks) {
  const result = validate(subTasks, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        'text': { type: 'string' },
        'completed': { type: 'boolean' }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate the relations object
 * @param {object} relations
 */
function validateRelations(relations) {
  const result = validate(relations, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        'type': { type: 'string' },
        'task': { type: 'string' }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate the comments object
 * @param {object} comments
 */
function validateComments(comments) {
  const result = validate(comments, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        'author': { type: 'string' },
        'date': { type: 'date' },
        'text': { type: 'string' }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

module.exports = {

  /**
   * Convert markdown into a task object
   * @param {string} data
   * @return {object}
   */
  md2json(data) {
    let id = '', name = '', description = '', metadata = {}, subTasks = [], relations = [], comments = [];
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
      const task = parsed[name];

      // Get id from name
      id = utility.getTaskId(name);

      // Parse metadata
      if ('Metadata' in task) {
        metadata = yaml.parse(task['Metadata'].raw.trim().replace(/```(yaml|yml)?/g, ''));
        validateMetadataFromMarkdown(metadata);

        // Check created/updated/completed/due dates
        if ('created' in metadata && !(metadata.created instanceof Date)) {
          const dateValue = chrono.parseDate(metadata.created);
          if (dateValue === null) {
            throw new Error('unable to parse created date');
          }
          metadata.created = dateValue;
        }
        if ('updated' in metadata && !(metadata.updated instanceof Date)) {
          const dateValue = chrono.parseDate(metadata.updated);
          if (dateValue === null) {
            throw new Error('unable to parse updated date');
          }
          metadata.updated = dateValue;
        }
        if ('started' in metadata && !(metadata.started instanceof Date)) {
          const dateValue = chrono.parseDate(metadata.started);
          if (dateValue === null) {
            throw new Error('unable to parse started date');
          }
          metadata.started = dateValue;
        }
        if ('completed' in metadata && !(metadata.completed instanceof Date)) {
          const dateValue = chrono.parseDate(metadata.completed);
          if (dateValue === null) {
            throw new Error('unable to parse completed date');
          }
          metadata.completed = dateValue;
        }
        if ('due' in metadata && !(metadata.due instanceof Date)) {
          const dateValue = chrono.parseDate(metadata.due);
          if (dateValue === null) {
            throw new Error('unable to parse due date');
          }
          metadata.due = dateValue;
        }

        // Check progress value
        if ('progress' in metadata) {
          const numberValue = parseFloat(metadata.progress);
          if (isNaN(numberValue)) {
            throw new Error('progress value is not numeric');
          }
          metadata.progress = numberValue;
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
          throw new Error('sub-tasks must contain a list');
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
          throw new Error('relations must contain a list');
        }
      }

      // Parse comments
      if ('Comments' in task) {
        try {
          const commentsHeading = '## Comments';
          const start = data.indexOf(commentsHeading) + commentsHeading.length;
          let end = data.substring(start).search(/\n#/);
          if (end >= 0) {
            end += start;
          } else {
            end = data.length;
          }
          const parsedComments = marked.lexer(data.slice(start, end).trim())[0].items;
          for (let parsedComment of parsedComments) {
            const comment = { text: [] };
            const parts = parsedComment.text.split('\n');
            for (let part of parts) {
              if (part.startsWith('date: ')) {
                const dateValue = chrono.parseDate(part.substring('date: '.length));
                if (dateValue === null) {
                  throw new Error('unable to parse comment date');
                }
                comment.date = dateValue;
              } else if (part.startsWith('author: ')) {
                comment.author = part.substring('author: '.length);
              } else {
                comment.text.push(part);
              }
            }
            comment.text = comment.text.join('\n').trim();
            comments.push(comment);
          }
        } catch (error) {
          throw new Error('comments must contain a list');
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
    return { id, name, description, metadata, subTasks, relations, comments };
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
        validateMetadataFromJSON(data.metadata);
        if (Object.keys(data.metadata).length > 0) {
          result.push(
            '## Metadata',
            `\`\`\`yaml\n${yaml.stringify(data.metadata, 4, 2).trim()}\n\`\`\``
          );
        }
      }

      // Add sub-tasks if present
      if ('subTasks' in data && data.subTasks !== null) {
        validateSubTasks(data.subTasks);
        if (data.subTasks.length > 0) {
          result.push(
            '## Sub-tasks',
            data.subTasks.map(subTask => `- [${subTask.completed ? 'x' : ' '}] ${subTask.text}`).join('\n')
          );
        }
      }

      // Add relations if present
      if ('relations' in data && data.relations !== null) {
        validateRelations(data.relations);
        if (data.relations.length > 0) {
          result.push(
            '## Relations',
            data.relations.map(
              relation => `- [${relation.type ? `${relation.type} ` : ''}${relation.task}](${relation.task}.md)`
            ).join('\n')
          );
        }
      }

      // Add comments if present
      if ('comments' in data && data.comments !== null) {
        validateComments(data.comments);
        if (data.comments.length > 0) {
          result.push(
            '## Comments',
            data.comments.map(comment => {
              const commentOutput = [];
              if ('author' in comment && comment.author) {
                commentOutput.push(`author: ${comment.author}`);
              }
              if ('date' in comment && comment.date) {
                commentOutput.push(`date: ${comment.date.toISOString()}`);
              }
              commentOutput.push(...comment.text.split('\n'));
              return `- ${commentOutput.map((v, i) => i > 0 ? `  ${v}` : v).join('\n')}`;
            }).join('\n')
          );
        }
      }
    } catch (error) {
      throw new Error(`Unable to build task: ${error.message}`);
    }

    // Filter empty lines and join into a string
    return `${result.filter(l => !!l).join('\n\n')}\n`;
  }
};
