const yaml = require('yamljs');

/**
 * The events a rule can listen for
 *
 * Mutation-only, by design: nothing here fires during a read, so `board`, `status`, `find` and
 * `burndown` stay a pure function of the files on disk
 */
const EVENT_TYPES = [
  'task.created',
  'task.moved',
  'task.updated',
  'task.commented',
  'task.archived',
  'task.restored',
  'task.deleted',
  'task.addedToBoard',
  'task.started',
  'task.completed'
];

// Events that aren't operations in their own right. They're computed as transitions - the predicate
// was false before the operation and true after it - so a rule meaning "when this is done" doesn't
// have to duplicate the column list that config already holds
const DERIVED_EVENT_TYPES = ['task.started', 'task.completed'];

// Operations that affect every board rather than the one the command was run on. Only rules on these
// events may set `anyBoard`, because only these events have a board other than the acting one that
// might want to hear about them
const WORKSPACE_WIDE_EVENTS = ['task.archived', 'task.restored', 'task.deleted'];

// Events where the task is leaving the board, so moving it makes no sense
const LEAVING_EVENTS = ['task.archived', 'task.deleted'];

// Events that have to act on other tasks, because acting on the task itself would be a write to a
// file that's about to be removed
const CROSS_TASK_ONLY_EVENTS = ['task.deleted'];

// The payload keys each event carries, beyond the board keys every event has. Used to check
// `@event.<key>` substitutions and `when` clauses that name an event key
const EVENT_PAYLOAD_KEYS = {
  'task.created': ['column'],
  'task.moved': ['fromColumn', 'toColumn'],
  'task.updated': ['changedFields', 'unsetFields'],
  'task.commented': ['comment'],
  'task.archived': ['fromColumn'],
  'task.restored': ['toColumn'],
  'task.deleted': ['fromColumn', 'removeFile', 'allBoards'],
  'task.addedToBoard': ['column', 'board']
};

// Board keys every event carries
const EVENT_BOARD_KEYS = ['board', 'boardSlug', 'isMainBoard'];

// The verbs a rule can use. Closed by design: the moment this needs a condition, a comparison or a
// variable it didn't come with, the answer is a script the user writes outside Kanbn
const VERBS = [
  'set',
  'unset',
  'assign',
  'addTag',
  'removeTag',
  'setProgress',
  'comment',
  'move',
  'addToBoard'
];

// Metadata fields Kanbn manages, which a rule may not write
const RESERVED_FIELDS = ['created', 'updated'];

// The author recorded against history events and comments a rule writes, so that an action-driven
// change is distinguishable from a human one
const ACTION_AUTHOR_PREFIX = '@kanbn';

/**
 * Normalise a relation type for comparison. Relation types are free text in a task file, so
 * "Child Of", "child-of" and "child of" all mean the same thing
 * @param {any} relationType
 * @return {string} The normalised relation type
 */
function normaliseRelationType(relationType) {
  return String(relationType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

/**
 * Coerce a value into an array, treating null and undefined as empty
 * @param {any} value
 * @return {any[]} The value as an array
 */
function toArray(value) {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Get the author to record against anything a rule writes
 * @param {object} rule The rule
 * @return {string} The author
 */
function ruleAuthor(rule) {
  return rule.name ? `${ACTION_AUTHOR_PREFIX}/${rule.name}` : ACTION_AUTHOR_PREFIX;
}

/**
 * Describe a rule for an error or warning message
 * @param {object} rule The rule
 * @param {number} i The rule's position in the list
 * @return {string} A label for the rule
 */
function ruleLabel(rule, i) {
  return rule && rule.name ? `rule "${rule.name}"` : `rule ${i + 1}`;
}

/**
 * Normalise the `actions` option into a list of rules
 *
 * Only the shape is normalised here - whether the contents make sense is findRuleErrors()' job, so
 * that a malformed rule produces a readable error instead of a type error somewhere downstream
 * @param {any} actions The raw actions option
 * @return {object[]} The rules
 */
function normaliseRules(actions) {
  return toArray(actions).map(
    (rule) => (rule !== null && typeof rule === 'object' && !Array.isArray(rule) ? rule : { invalid: rule })
  );
}

/**
 * Parse the contents of an actionsFile
 * @param {string} contents The file contents
 * @param {string} fileName The file name, for error messages
 * @return {object[]} The rules
 */
function parseActionsFile(contents, fileName) {
  let parsed = null;
  try {
    parsed = contents.trim() ? yaml.parse(contents) : [];
  } catch (error) {
    throw new Error(`Unable to parse actionsFile "${fileName}": ${error.message}`);
  }

  // A file holding nothing but a list is the shape this option is for. An object with an `actions`
  // key is accepted too, because it's what someone who has just moved the block out of front matter
  // will write first
  if (parsed !== null && !Array.isArray(parsed) && typeof parsed === 'object' && 'actions' in parsed) {
    parsed = parsed.actions;
  }
  if (parsed === null || parsed === undefined) {
    return [];
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`actionsFile "${fileName}" must contain a list of rules`);
  }
  return normaliseRules(parsed);
}

/**
 * Find the substitution tokens used in a value, however deeply nested
 * @param {any} value The value to search
 * @param {string[]} [found=[]] Tokens found so far
 * @return {string[]} The tokens found, including the leading @
 */
function findSubstitutions(value, found = []) {
  if (typeof value === 'string') {
    const matches = value.match(/@[a-zA-Z][a-zA-Z0-9_.]*/g);
    if (matches !== null) {
      found.push(...matches);
    }
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => findSubstitutions(item, found));
    return found;
  }
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((item) => findSubstitutions(item, found));
  }
  return found;
}

/**
 * Check a list of rules and return everything wrong with them
 *
 * These are configuration errors rather than runtime failures: they're wrong in the file, not wrong
 * at the moment they run, so validate reports them and an operation that meets one fails before
 * writing anything
 * @param {object[]} rules The rules to check
 * @param {object} [context={}] `columns` on this board and `boards` in the workspace, when known
 * @return {string[]} A list of error messages
 */
function findRuleErrors(rules, context = {}) {
  const errors = [];
  const columns = context.columns || null;
  const boards = context.boards || null;

  rules.forEach((rule, i) => {
    const label = ruleLabel(rule, i);
    if ('invalid' in rule) {
      errors.push(`${label} is not an object`);
      return;
    }
    if ('name' in rule && typeof rule.name !== 'string') {
      errors.push(`${label} has a non-string name`);
    }

    // Event
    if (!('on' in rule)) {
      errors.push(`${label} has no "on" event`);
    } else if (EVENT_TYPES.indexOf(rule.on) === -1) {
      errors.push(`${label} listens for unknown event "${rule.on}"`);
    }
    const eventType = EVENT_TYPES.indexOf(rule.on) === -1 ? null : rule.on;

    // Rules that execute code were declined, so `run` is worth naming explicitly rather than
    // failing as an unknown key - it's the thing someone who read an old draft will try
    if ('run' in rule) {
      errors.push(`${label} uses "run", which Kanbn doesn't support - actions are declarative only`);
    }

    // Conditions
    const whenIsObject = rule.when === undefined ||
      (rule.when !== null && typeof rule.when === 'object' && !Array.isArray(rule.when));
    if (!whenIsObject) {
      errors.push(`${label} has a "when" that isn't an object`);
    }
    if (eventType !== null && whenIsObject && rule.when !== undefined) {
      const payloadKeys = EVENT_PAYLOAD_KEYS[eventType] || null;
      for (const key of Object.keys(rule.when)) {
        if (EVENT_BOARD_KEYS.indexOf(key) !== -1) {
          continue;
        }

        // A `when` key that names an event payload key belonging to a different event is almost
        // always a rule written against the wrong event, and would otherwise never match
        const belongsElsewhere = Object.entries(EVENT_PAYLOAD_KEYS).some(
          ([type, keys]) => type !== eventType && keys.indexOf(key) !== -1
        );
        if (payloadKeys !== null && payloadKeys.indexOf(key) === -1 && belongsElsewhere) {
          errors.push(`${label} filters on "${key}", which ${eventType} doesn't carry`);
        }
      }
    }

    // Targets
    if ('for' in rule) {
      const target = rule.for;
      if (target === null || typeof target !== 'object' || Array.isArray(target)) {
        errors.push(`${label} has a "for" that isn't an object`);
      } else {
        if ('related' in target && typeof target.related !== 'string') {
          errors.push(`${label} has a "for.related" that isn't a relation type`);
        }
        if ('direction' in target && ['incoming', 'outgoing'].indexOf(target.direction) === -1) {
          errors.push(`${label} has an unknown "for.direction" - use "incoming" or "outgoing"`);
        }
        if (
          'where' in target &&
          (target.where === null || typeof target.where !== 'object' || Array.isArray(target.where))
        ) {
          errors.push(`${label} has a "for.where" that isn't an object`);
        }
        for (const key of Object.keys(target)) {
          if (['related', 'direction', 'where'].indexOf(key) === -1) {
            errors.push(`${label} has an unknown "for" key "${key}"`);
          }
        }
      }
    } else if (eventType !== null && CROSS_TASK_ONLY_EVENTS.indexOf(eventType) !== -1) {
      errors.push(
        `${label} listens for ${eventType} without a "for" clause - the task is being removed, so a ` +
        'rule on this event has to act on related tasks'
      );
    }

    // Listening from other boards
    if ('anyBoard' in rule) {
      if (typeof rule.anyBoard !== 'boolean') {
        errors.push(`${label} has a non-boolean "anyBoard"`);
      } else if (eventType !== null && WORKSPACE_WIDE_EVENTS.indexOf(eventType) === -1) {
        errors.push(
          `${label} sets "anyBoard" on ${eventType}, which is scoped to one board - only ` +
          `${WORKSPACE_WIDE_EVENTS.join(', ')} affect every board`
        );
      }
    }

    // Unknown keys, so that a typo in a rule doesn't silently do nothing
    for (const key of Object.keys(rule)) {
      if (['name', 'on', 'when', 'for', 'then', 'anyBoard', 'run'].indexOf(key) === -1) {
        errors.push(`${label} has an unknown key "${key}"`);
      }
    }

    // Verbs
    if (!('then' in rule)) {
      errors.push(`${label} has no "then" verbs`);
      return;
    }
    if (!Array.isArray(rule.then)) {
      errors.push(`${label} has a "then" that isn't a list`);
      return;
    }
    rule.then.forEach((verb, j) => {
      if (verb === null || typeof verb !== 'object' || Array.isArray(verb)) {
        errors.push(`${label} verb ${j + 1} is not an object`);
        return;
      }
      const names = Object.keys(verb);
      if (names.length !== 1) {
        errors.push(
          `${label} verb ${j + 1} has ${names.length} keys - each verb is a single key, so write them ` +
          'as separate list items'
        );
        return;
      }
      const [name] = names;
      const argument = verb[name];
      if (VERBS.indexOf(name) === -1) {
        errors.push(`${label} uses unknown verb "${name}"`);
        return;
      }
      switch (name) {
        case 'set':
          if (argument === null || typeof argument !== 'object' || Array.isArray(argument)) {
            errors.push(`${label} "set" needs an object of fields and values`);
            break;
          }
          for (const field of Object.keys(argument)) {
            if (RESERVED_FIELDS.indexOf(field) !== -1) {
              errors.push(`${label} sets "${field}", which Kanbn manages`);
            }
          }
          break;
        case 'unset':
          for (const field of toArray(argument)) {
            if (typeof field !== 'string') {
              errors.push(`${label} "unset" needs a field name or a list of them`);
            } else if (RESERVED_FIELDS.indexOf(field) !== -1) {
              errors.push(`${label} unsets "${field}", which Kanbn manages`);
            }
          }
          break;
        case 'assign':
          if (typeof argument !== 'string') {
            errors.push(`${label} "assign" needs a name`);
          }
          break;
        case 'addTag':
        case 'removeTag':
          if (!toArray(argument).length || toArray(argument).some((tag) => typeof tag !== 'string')) {
            errors.push(`${label} "${name}" needs a tag or a list of tags`);
          }
          break;
        case 'setProgress':
          if (typeof argument !== 'number' || argument < 0 || argument > 1) {
            errors.push(`${label} "setProgress" needs a number between 0 and 1`);
          }
          break;
        case 'comment':
          if (typeof argument !== 'string' || !argument.trim()) {
            errors.push(`${label} "comment" needs some text`);
          }
          break;
        case 'move': {
          const column = argument !== null && typeof argument === 'object' ? argument.column : argument;
          if (typeof column !== 'string' || !column) {
            errors.push(`${label} "move" needs a column`);
            break;
          }
          // A column that comes from a substitution isn't knowable until the rule fires, so it is
          // left to the runtime, which skips it with a warning rather than failing
          if (columns !== null && findSubstitutions(column).length === 0 && columns.indexOf(column) === -1) {
            errors.push(`${label} moves to column "${column}", which doesn't exist on this board`);
          }
          if (
            argument !== null &&
            typeof argument === 'object' &&
            'position' in argument &&
            typeof argument.position !== 'number'
          ) {
            errors.push(`${label} "move" has a non-numeric position`);
          }
          if (eventType !== null && LEAVING_EVENTS.indexOf(eventType) !== -1 && !('for' in rule)) {
            errors.push(`${label} moves a task on ${eventType}, but the task is leaving the board`);
          }
          if (rule.anyBoard === true) {
            errors.push(
              `${label} sets "anyBoard" and moves a task - a rule listening from another board names ` +
              "columns that belong to its own board, so it can't move anything"
            );
          }
          break;
        }
        case 'addToBoard': {
          if (argument === null || typeof argument !== 'object' || Array.isArray(argument)) {
            errors.push(`${label} "addToBoard" needs a board and a column`);
            break;
          }
          if (typeof argument.board !== 'string' || !argument.board) {
            errors.push(`${label} "addToBoard" needs a board`);
          } else if (
            boards !== null &&
            findSubstitutions(argument.board).length === 0 &&
            boards.indexOf(argument.board) === -1
          ) {
            errors.push(`${label} adds to board "${argument.board}", which doesn't exist`);
          }
          if (typeof argument.column !== 'string' || !argument.column) {
            errors.push(`${label} "addToBoard" needs a column`);
          }
          break;
        }
      }
    });

    // Substitutions
    if (eventType !== null && Array.isArray(rule.then)) {
      const payloadKeys = [...(EVENT_PAYLOAD_KEYS[eventType] || []), ...EVENT_BOARD_KEYS];
      const known = ['@me', '@now', '@task.id', '@task.name', '@board', '@event.task.id', '@event.task.name'];
      for (const token of new Set(findSubstitutions(rule.then))) {
        if (known.indexOf(token) !== -1) {
          continue;
        }
        if (token.startsWith('@event.')) {
          const key = token.slice('@event.'.length);

          // A derived event carries whatever the operation that caused it carried, so its payload
          // isn't knowable from the rule alone - those are left to the runtime, which skips them
          // with a warning rather than failing
          if (DERIVED_EVENT_TYPES.indexOf(eventType) === -1 && payloadKeys.indexOf(key) === -1) {
            errors.push(`${label} uses "${token}", which ${eventType} doesn't carry`);
          }
          continue;
        }
        errors.push(`${label} uses unknown substitution "${token}"`);
      }
    }
  });
  return errors;
}

/**
 * Find things about a rule set that are legal but probably not what the author meant
 * @param {object[]} rules The rules to check
 * @param {object} [context={}] `hasUser` is false when no current user can be resolved
 * @return {object[]} A list of {type, message} warnings
 */
function findRuleWarnings(rules, context = {}) {
  const warnings = [];

  // Two rules on the same event writing the same field means last-wins, silently
  const writers = new Map();
  rules.forEach((rule, i) => {
    if (rule === null || typeof rule !== 'object' || !Array.isArray(rule.then)) {
      return;
    }
    const fields = new Set();
    for (const verb of rule.then) {
      if (verb === null || typeof verb !== 'object') {
        continue;
      }
      if ('set' in verb && verb.set !== null && typeof verb.set === 'object') {
        Object.keys(verb.set).forEach((field) => fields.add(field));
      }
      if ('assign' in verb) {
        fields.add('assigned');
      }
      if ('setProgress' in verb) {
        fields.add('progress');
      }
      if ('move' in verb) {
        fields.add('(column)');
      }
    }
    for (const field of fields) {
      const key = `${rule.on} ${field}`;
      if (!writers.has(key)) {
        writers.set(key, []);
      }
      writers.get(key).push(ruleLabel(rule, i));
    }
  });
  for (const [key, labels] of writers) {
    if (labels.length < 2) {
      continue;
    }
    const [eventType, field] = key.split(' ');
    warnings.push({
      type: 'conflicting-actions',
      message:
        `${labels.join(' and ')} both write ${field === '(column)' ? "the task's column" : `"${field}"`} on ` +
        `${eventType} - the last one wins`
    });
  }

  // A rule using @me on a machine with no resolvable user skips that verb every time it fires
  if (context.hasUser === false) {
    rules.forEach((rule, i) => {
      if (findSubstitutions(rule.then).indexOf('@me') !== -1) {
        warnings.push({
          type: 'unresolvable-user',
          message:
            `${ruleLabel(rule, i)} uses "@me", but no user can be resolved here - set KANBN_USER or a git ` +
            'user, or those verbs will be skipped'
        });
      }
    });
  }
  return warnings;
}

/**
 * Build the substitution table for a rule firing on a task
 * @param {object} params The task being written, the task the event fired for, and the event context
 * @return {object} A map of token to value
 */
function buildSubstitutions({ task, eventTask, payload, user, date, boardSlug }) {
  const substitutions = {
    '@now': date,
    '@task.id': task.id,
    '@task.name': task.name,
    '@event.task.id': eventTask.id,
    '@event.task.name': eventTask.name,
    '@board': boardSlug
  };

  // A machine with no resolvable user has no @me, and a verb that needs one is skipped rather than
  // writing an empty value
  if (user) {
    substitutions['@me'] = user;
  }
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined || typeof value === 'object') {
      continue;
    }
    substitutions[`@event.${key}`] = value;
  }
  return substitutions;
}

/**
 * Replace substitution tokens in a value
 *
 * A value that is nothing but a token keeps the token's type, so `'@now'` writes a date rather than
 * a string. A token used inside a longer string is interpolated
 * @param {any} value The value to substitute into
 * @param {object} substitutions A map of token to value
 * @param {string[]} unresolved Tokens that couldn't be resolved are pushed here
 * @return {any} The substituted value
 */
function substitute(value, substitutions, unresolved) {
  if (Array.isArray(value)) {
    return value.map((item) => substitute(item, substitutions, unresolved));
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substitute(item, substitutions, unresolved)])
    );
  }
  if (typeof value !== 'string') {
    return value;
  }
  const tokens = findSubstitutions(value);
  if (!tokens.length) {
    return value;
  }

  // Longest first, so that @event.task.id isn't consumed by a shorter token that prefixes it
  const ordered = [...new Set(tokens)].sort((a, b) => b.length - a.length);
  if (ordered.length === 1 && value.trim() === ordered[0]) {
    const token = ordered[0];
    if (!(token in substitutions)) {
      unresolved.push(token);
      return undefined;
    }
    return substitutions[token];
  }
  let result = value;
  for (const token of ordered) {
    if (!(token in substitutions)) {
      unresolved.push(token);
      continue;
    }
    const replacement = substitutions[token];
    result = result.split(token).join(replacement instanceof Date ? replacement.toISOString() : String(replacement));
  }
  return result;
}

/**
 * Check a rule's `when` clause against the event payload
 *
 * Event keys are matched exactly rather than as substrings, because a column called "Done" should
 * not match a rule written for "Done Later". A list matches any of its values
 * @param {object} when The event keys from the rule's when clause
 * @param {object} payload The event payload
 * @return {boolean} False if an event key in the filter doesn't match
 */
function matchEventKeys(when, payload) {
  for (const [key, expected] of Object.entries(when)) {
    if (!(key in payload)) {
      continue;
    }
    const actual = payload[key];
    const options = toArray(expected);
    if (Array.isArray(actual)) {
      if (!options.some((option) => actual.indexOf(option) !== -1)) {
        return false;
      }
      continue;
    }
    if (!options.some((option) => option === actual)) {
      return false;
    }
  }
  return true;
}

/**
 * Split a `when` clause into the keys that belong to the event and the keys that belong to the task
 * @param {object} when The rule's when clause
 * @param {object} payload The event payload
 * @return {object} {eventFilters, taskFilters}
 */
function splitFilters(when, payload) {
  const eventFilters = {};
  const taskFilters = {};
  for (const [key, value] of Object.entries(when || {})) {
    if (key in payload || EVENT_BOARD_KEYS.indexOf(key) !== -1) {
      eventFilters[key] = value;
    } else {
      taskFilters[key] = value;
    }
  }
  return { eventFilters, taskFilters };
}

/**
 * Apply one verb to one task
 * @param {object} params The verb, the task it applies to, and the context it resolves against
 */
function applyVerb({ name, argument, task, patch, rule, index, helpers, substitutions, date, warnings, label }) {
  const unresolved = [];
  const value = substitute(argument, substitutions, unresolved);
  if (unresolved.length) {
    warnings.push(`${label} skipped "${name}": ${[...new Set(unresolved)].join(', ')} couldn't be resolved`);
    return;
  }
  const author = ruleAuthor(rule);
  switch (name) {
    case 'set':
      for (const [field, fieldValue] of Object.entries(value)) {
        helpers.setTaskMetadata(task, field, fieldValue);
      }
      break;
    case 'unset':
      for (const field of toArray(value)) {
        helpers.setTaskMetadata(task, field, undefined);
      }
      break;
    case 'assign':
      helpers.setTaskMetadata(task, 'assigned', value);
      break;
    case 'addTag': {
      const tags = [...(helpers.getTaskMetadata(task, 'tags') || [])];
      for (const tag of toArray(value)) {
        if (tags.indexOf(tag) === -1) {
          tags.push(tag);
        }
      }
      helpers.setTaskMetadata(task, 'tags', tags);
      break;
    }
    case 'removeTag': {
      const remove = toArray(value);
      const tags = (helpers.getTaskMetadata(task, 'tags') || []).filter((tag) => remove.indexOf(tag) === -1);
      helpers.setTaskMetadata(task, 'tags', tags);
      break;
    }
    case 'setProgress': {
      const from = helpers.getTaskMetadata(task, 'progress') || 0;
      if (from === value) {
        break;
      }
      helpers.setTaskMetadata(task, 'progress', value);
      helpers.appendTaskHistory(task, { date, type: 'progress', fromProgress: from, toProgress: value }, null, author);
      break;
    }
    case 'comment':
      // A task on its way to being created may not have been through the parser yet, so its
      // optional lists aren't guaranteed to exist
      if (!Array.isArray(task.comments)) {
        task.comments = [];
      }
      task.comments.push({ text: value, author, date });
      break;
    case 'move': {
      const column = value !== null && typeof value === 'object' ? value.column : value;
      if (!(column in index.columns)) {
        warnings.push(`${label} skipped "move": column "${column}" doesn't exist on this board`);
        break;
      }
      patch.moveTo = {
        column,
        position: value !== null && typeof value === 'object' && 'position' in value ? value.position : null,
        author
      };
      break;
    }
    case 'addToBoard':
      patch.boardAdds.push({ board: value.board, column: value.column, author });
      break;
  }
}

/**
 * Select the tasks a rule acts on
 * @param {object} params The rule, the task the event fired for, and the readers to find others with
 * @return {Promise<object[]>} The tasks to apply the rule's verbs to
 */
async function selectTargets({ rule, task, index, helpers, loadTask, loadAllTasks, warnings, label }) {
  const target = rule.for;
  const wanted = 'related' in target ? normaliseRelationType(target.related) : null;
  const direction = target.direction || 'outgoing';
  let candidates = [];

  if (direction === 'outgoing') {
    // The relations are in the task file that's already loaded, so this costs nothing beyond reading
    // the tasks it names
    const seen = new Set();
    for (const relation of task.relations || []) {
      if (relation === null || !relation.task) {
        continue;
      }
      if (wanted !== null && normaliseRelationType(relation.type) !== wanted) {
        continue;
      }
      if (seen.has(relation.task)) {
        continue;
      }
      seen.add(relation.task);
      const related = await loadTask(relation.task);
      if (related === null) {
        warnings.push(`${label} skipped related task "${relation.task}": no task file`);
        continue;
      }
      candidates.push(related);
    }
  } else {
    // Kanbn doesn't maintain inverse relations, so finding the tasks that point at this one means
    // reading them all - the same cost as kanbn find, and only paid by a workspace that has such a
    // rule
    const all = await loadAllTasks();
    candidates = all.filter((candidate) =>
      (candidate.relations || []).some(
        (relation) =>
          relation !== null &&
          relation.task === task.id &&
          (wanted === null || normaliseRelationType(relation.type) === wanted)
      )
    );
  }

  // The task the event fired for is never its own target, however the relations are drawn
  candidates = candidates.filter((candidate) => candidate.id !== task.id);
  if ('where' in target && Object.keys(target.where || {}).length) {
    candidates = helpers.filterTasks(index, candidates, target.where);
  }
  return candidates;
}

/**
 * Run the rules that match an event
 *
 * Everything this returns is a patch: nothing is written here, and nothing it produces fires another
 * event. That's what makes "actions never fire actions" structural rather than a limit with a dial
 * @param {object} params The rules, the event, and the state the operation is about to write
 * @return {Promise<object>} {patch, targets, warnings}
 */
async function run({ rules, eventTypes, payload, index, task, date, user, boardSlug, helpers, loadTask, loadAllTasks }) {
  const warnings = [];
  const patch = { moveTo: null, boardAdds: [] };
  const targets = new Map();

  // A target loaded once here is the object every rule mutates, so two rules acting on the same
  // target compose the way two verbs in one rule do
  const loaded = new Map();
  const targetPatch = (targetTask) => {
    if (!targets.has(targetTask.id)) {
      targets.set(targetTask.id, { task: targetTask, moveTo: null, boardAdds: [] });
    }
    return targets.get(targetTask.id);
  };
  const loadTargetOnce = async (taskId) => {
    if (!loaded.has(taskId)) {
      loaded.set(taskId, await loadTask(taskId));
    }
    return loaded.get(taskId);
  };
  let allTasks = null;
  const loadAllTargetsOnce = async () => {
    if (allTasks === null) {
      allTasks = await loadAllTasks();
      for (const candidate of allTasks) {
        if (!loaded.has(candidate.id)) {
          loaded.set(candidate.id, candidate);
        }
      }
    }

    // Anything already loaded by an outgoing selector is reused, so one operation never holds two
    // copies of the same task
    return allTasks.map((candidate) => loaded.get(candidate.id) || candidate);
  };

  for (const eventType of eventTypes) {
    for (const rule of rules) {
      if (rule.on !== eventType) {
        continue;
      }
      const label = ruleLabel(rule, rules.indexOf(rule));
      const { eventFilters, taskFilters } = splitFilters(rule.when || {}, payload);

      // The event has to match before the task does, because an event key that doesn't match makes
      // the task irrelevant
      if (!matchEventKeys(eventFilters, payload)) {
        continue;
      }
      if (Object.keys(taskFilters).length && !helpers.filterTasks(index, [task], taskFilters).length) {
        continue;
      }

      const acting =
        'for' in rule
          ? await selectTargets({
              rule,
              task,
              index,
              helpers,
              loadTask: loadTargetOnce,
              loadAllTasks: loadAllTargetsOnce,
              warnings,
              label
            })
          : [task];
      for (const actingTask of acting) {
        const isEventTask = actingTask.id === task.id;
        const substitutions = buildSubstitutions({
          task: actingTask,
          eventTask: task,
          payload,
          user,
          date,
          boardSlug
        });
        const actingPatch = isEventTask ? patch : targetPatch(actingTask);
        for (const verb of rule.then) {
          const [name] = Object.keys(verb);
          applyVerb({
            name,
            argument: verb[name],
            task: actingTask,
            patch: actingPatch,
            rule,
            index,
            helpers,
            substitutions,
            date,
            warnings,
            label
          });
        }
      }
    }
  }
  return { patch, targets: [...targets.values()], warnings };
}

module.exports = {
  EVENT_TYPES,
  DERIVED_EVENT_TYPES,
  WORKSPACE_WIDE_EVENTS,
  LEAVING_EVENTS,
  CROSS_TASK_ONLY_EVENTS,
  EVENT_PAYLOAD_KEYS,
  EVENT_BOARD_KEYS,
  VERBS,
  RESERVED_FIELDS,
  ACTION_AUTHOR_PREFIX,
  normaliseRules,
  parseActionsFile,
  findRuleErrors,
  findRuleWarnings,
  findSubstitutions,
  normaliseRelationType,
  substitute,
  run
};
