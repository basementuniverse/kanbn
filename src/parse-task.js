const yaml = require('yamljs');
const fm = require('front-matter');
const marked = require('marked');
const utility = require('./utility');
const chrono = require('chrono-node');
const validate = require('jsonschema').validate;
const parseMarkdown = require('./parse-markdown');

/**
 * Compile separate headings together into a task description
 * @param {object} data
 */
function compileDescription(data) {
  const description = [];
  if ('raw' in data) {
    description.push(data.raw.content.replace(/[\r\n]{3}/g, '\n\n').trim());
  }
  for (let heading in data) {
    if (['raw', 'Metadata', 'Sub-tasks', 'Relations', 'History', 'Comments'].indexOf(heading) !== -1) {
      continue;
    }
    description.push(
      /^# (.*)/.test(data[heading].heading) ? '' : data[heading].heading,
      data[heading].content
    );
  }
  return description.join('\n\n').trim();
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
      'postponed': {
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
      'postponed': { type: 'date'},
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

/**
 * Validate the history object converted from Markdown
 * @param {object[]} history
 */
function validateHistoryFromMarkdown(history) {
  const result = validate(history, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        'type': { type: 'string' },
        'date': {
          oneOf: [
            { type: 'string' },
            { type: 'date' }
          ]
        },
        'column': { type: 'string' },
        'fromColumn': { type: 'string' },
        'toColumn': { type: 'string' },
        'author': { type: 'string' },
        'fromProgress': { oneOf: [{ type: 'number' }, { type: 'string' }] },
        'toProgress': { oneOf: [{ type: 'number' }, { type: 'string' }] }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate the history object converted from JSON
 * @param {object[]} history
 */
function validateHistoryFromJSON(history) {
  const result = validate(history, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        'type': { type: 'string' },
        'date': { type: 'date' },
        'column': { type: 'string' },
        'fromColumn': { type: 'string' },
        'toColumn': { type: 'string' },
        'author': { type: 'string' },
        'fromProgress': { type: 'number' },
        'toProgress': { type: 'number' }
      }
    }
  });
  if (result.errors.length) {
    throw new Error(result.errors.map(error => `\n${error.property} ${error.message}`).join(''));
  }
}

/**
 * Validate required fields in a history event
 * @param {object} historyEvent
 */
function validateHistoryEvent(historyEvent) {
  if (!historyEvent.type) {
    throw new Error('history event is missing type');
  }
  if (!historyEvent.date) {
    throw new Error(`history event "${historyEvent.type}" is missing date`);
  }
  switch (historyEvent.type) {
    case 'created':
      if (!historyEvent.column) {
        throw new Error('created history event is missing column');
      }
      break;
    case 'moved':
      if (!historyEvent.fromColumn || !historyEvent.toColumn) {
        throw new Error('moved history event is missing fromColumn or toColumn');
      }
      break;
    case 'progress':
      if (historyEvent.fromProgress === undefined || historyEvent.toProgress === undefined) {
        throw new Error('progress history event is missing fromProgress or toProgress');
      }
      break;
    case 'archived':
      if (!historyEvent.fromColumn) {
        throw new Error('archived history event is missing fromColumn');
      }
      break;
    case 'restored':
      if (!historyEvent.toColumn) {
        throw new Error('restored history event is missing toColumn');
      }
      break;
    default:
      throw new Error(`unsupported history event type "${historyEvent.type}"`);
  }
}

module.exports = {

  /**
   * Convert markdown into a task object
   * @param {string} data
   * @return {object}
   */
  md2json(data) {
    let id = '', name = '', description = '', metadata = {}, subTasks = [], relations = [], history = [], comments = [];
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
        ({ attributes: metadata, body: data } = fm(data));

        // Make sure the front matter contains an object
        if (typeof metadata !== 'object') {
          throw new Error('invalid front matter content');
        }
      }

      // Parse markdown to an object
      let task = null;
      try {
        task = parseMarkdown(data);
      } catch (error) {
        throw new Error(`invalid markdown (${error.message})`);
      }

      // Check resulting object
      const taskHeadings = Object.keys(task);
      if (taskHeadings.length === 0 || taskHeadings[0] === 'raw') {
        throw new Error('data is missing a name heading');
      }

      // Get name
      name = taskHeadings[0];

      // Get id from name
      id = utility.getTaskId(name);

      // Parse metadata
      // Metadata will be serialized back to front-matter, this check remains here for backwards compatibility
      if ('Metadata' in task) {

        // Get embedded metadata and make sure it's an object
        const embeddedMetadata = yaml.parse(task['Metadata'].content.trim().replace(/```(yaml|yml)?/g, ''));
        if (typeof embeddedMetadata !== 'object') {
          throw new Error('invalid metadata content');
        }

        // Merge with front matter metadata
        metadata = Object.assign(metadata, embeddedMetadata);
        delete task['Metadata'];
      }
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
      if ('postponed' in metadata && !(metadata.postponed instanceof Date)) {
        const dateValue = chrono.parseDate(metadata.postponed);
        if (dateValue === null) {
          throw new Error('unable to parse postponed date');
        }
        metadata.postponed = dateValue;
      }

      // Check progress value
      if ('progress' in metadata) {
        const numberValue = parseFloat(metadata.progress);
        if (isNaN(numberValue)) {
          throw new Error('progress value is not numeric');
        }
        metadata.progress = numberValue;
      }

      // Parse sub-tasks
      if ('Sub-tasks' in task) {
        try {
          subTasks = marked.lexer(task['Sub-tasks'].content)[0].items.map(item => ({
            text: item.text.trim(),
            completed: item.checked || false
          }));
        } catch (error) {
          throw new Error('sub-tasks must contain a list');
        }
        delete task['Sub-tasks'];
      }

      // Parse relations
      if ('Relations' in task) {
        try {
          relations = marked.lexer(task['Relations'].content)[0].items.map(item => {
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
        delete task['Relations'];
      }

      // Parse comments
      if ('Comments' in task) {
        try {
          // const commentsHeading = '## Comments';
          // const start = data.indexOf(commentsHeading) + commentsHeading.length;
          // let end = data.substring(start).search(/\n#/);
          // if (end >= 0) {
          //   end += start;
          // } else {
          //   end = data.length;
          // }
          // const parsedComments = marked.lexer(data.slice(start, end).trim())[0].items;
          const parsedComments = marked.lexer(task['Comments'].content)[0].items;
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
        delete task['Comments'];
      }

      // Parse history
      if ('History' in task) {
        try {
          const parsedHistory = marked.lexer(task['History'].content)[0].items;
          for (let parsedHistoryEvent of parsedHistory) {
            const historyEvent = {};
            const parts = parsedHistoryEvent.text.split('\n');
            for (let part of parts) {
              const parsedPart = part.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
              if (!parsedPart) {
                continue;
              }
              const key = parsedPart[1];
              historyEvent[key] = parsedPart[2].trim();
            }
            history.push(historyEvent);
          }
        } catch (error) {
          throw new Error('history must contain a list');
        }
        delete task['History'];

        // Validate basic history structure before value coercion
        validateHistoryFromMarkdown(history);

        // Parse and validate event dates and numeric fields
        history = history.map((historyEvent) => {
          if (!(historyEvent.date instanceof Date)) {
            const dateValue = chrono.parseDate(historyEvent.date);
            if (dateValue === null) {
              throw new Error(`unable to parse history event date for "${historyEvent.type || 'unknown'}"`);
            }
            historyEvent.date = dateValue;
          }

          if ('fromProgress' in historyEvent) {
            const fromProgressValue = parseFloat(historyEvent.fromProgress);
            if (isNaN(fromProgressValue)) {
              throw new Error('history event fromProgress value is not numeric');
            }
            historyEvent.fromProgress = fromProgressValue;
          }

          if ('toProgress' in historyEvent) {
            const toProgressValue = parseFloat(historyEvent.toProgress);
            if (isNaN(toProgressValue)) {
              throw new Error('history event toProgress value is not numeric');
            }
            historyEvent.toProgress = toProgressValue;
          }

          validateHistoryEvent(historyEvent);
          return historyEvent;
        });
      }

      // Assemble description
      // const descriptionParts = [];
      description = compileDescription(task);
      // description = descriptionParts.join('\n\n');
    } catch (error) {
      throw new Error(`Unable to parse task: ${error.message}`);
    }

    // Assemble task object
    const result = { id, name, description, metadata, subTasks, relations, comments };
    if (history.length > 0) {
      result.history = history;
    }
    return result;
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

      // Add metadata as front-matter content if present
      if ('metadata' in data && data.metadata !== null) {
        validateMetadataFromJSON(data.metadata);
        if (Object.keys(data.metadata).length > 0) {
          result.push(
            `---\n${yaml.stringify(data.metadata, 4, 2).trim()}\n---`
          );
        }
      }

      // Add name and description
      result.push(`# ${data.name}`);
      if ('description' in data) {
        result.push(data.description);
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

      // Add history if present
      if ('history' in data && data.history !== null) {
        validateHistoryFromJSON(data.history);
        data.history.forEach(validateHistoryEvent);
        if (data.history.length > 0) {
          result.push(
            '## History',
            data.history.map((historyEvent) => {
              const historyEventOutput = [];
              historyEventOutput.push(`type: ${historyEvent.type}`);
              historyEventOutput.push(`date: ${historyEvent.date.toISOString()}`);
              if ('column' in historyEvent) {
                historyEventOutput.push(`column: ${historyEvent.column}`);
              }
              if ('fromColumn' in historyEvent) {
                historyEventOutput.push(`fromColumn: ${historyEvent.fromColumn}`);
              }
              if ('toColumn' in historyEvent) {
                historyEventOutput.push(`toColumn: ${historyEvent.toColumn}`);
              }
              if ('fromProgress' in historyEvent) {
                historyEventOutput.push(`fromProgress: ${historyEvent.fromProgress}`);
              }
              if ('toProgress' in historyEvent) {
                historyEventOutput.push(`toProgress: ${historyEvent.toProgress}`);
              }
              if ('author' in historyEvent && historyEvent.author) {
                historyEventOutput.push(`author: ${historyEvent.author}`);
              }
              return `- ${historyEventOutput.map((v, i) => i > 0 ? `  ${v}` : v).join('\n')}`;
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
