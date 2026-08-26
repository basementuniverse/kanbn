const parseTask = require('../../src/parse-task');

QUnit.module('task parsing error tests');

/**
 * Build a task markdown file with the given front matter and body
 * @param {string} frontMatter The YAML front matter contents
 * @param {string} [body='# Test Task'] The markdown body
 * @return {string} The task file contents
 */
function taskFile(frontMatter, body = '# Test Task') {
  return `---\n${frontMatter}\n---\n\n${body}`;
}

const invalidMarkdown = [
  {
    name: 'null data',
    md: null,
    error: /data is null or empty/
  },
  {
    name: 'empty data',
    md: '',
    error: /data is null or empty/
  },
  {
    name: 'non-string data',
    md: 123,
    error: /data is not a string/
  },
  {
    name: 'unparseable markdown',
    md: ' ',
    error: /invalid markdown \(data is an empty string\)/
  },
  {
    name: 'no name heading',
    md: 'Just some text with no heading',
    error: /data is missing a name heading/
  },
  {
    name: 'unparseable created date',
    md: taskFile('created: not-a-date'),
    error: /unable to parse created date/
  },
  {
    name: 'unparseable updated date',
    md: taskFile('updated: not-a-date'),
    error: /unable to parse updated date/
  },
  {
    name: 'unparseable started date',
    md: taskFile('started: not-a-date'),
    error: /unable to parse started date/
  },
  {
    name: 'unparseable completed date',
    md: taskFile('completed: not-a-date'),
    error: /unable to parse completed date/
  },
  {
    name: 'unparseable due date',
    md: taskFile('due: not-a-date'),
    error: /unable to parse due date/
  },
  {
    name: 'unparseable plannedStart date',
    md: taskFile('plannedStart: not-a-date'),
    error: /unable to parse plannedStart date/
  },
  {
    name: 'unparseable plannedFinish date',
    md: taskFile('plannedFinish: not-a-date'),
    error: /unable to parse plannedFinish date/
  },
  {
    name: 'non-numeric progress',
    md: taskFile('progress: not-a-number'),
    error: /instance\.progress is not of a type\(s\) number/
  },
  {
    name: 'non-array tags',
    md: taskFile('tags: not-an-array'),
    error: /Unable to parse task/
  },
  {
    name: 'embedded metadata that is not an object',
    md: '# Test Task\n\n## Metadata\n\njust text',
    error: /invalid metadata content/
  }
];

QUnit.test('md2json should reject invalid task files', assert => {
  for (const testCase of invalidMarkdown) {
    assert.throws(
      () => parseTask.md2json(testCase.md),
      testCase.error,
      `should reject ${testCase.name}`
    );
  }
});

QUnit.test('md2json should parse dates written as strings', assert => {
  const task = parseTask.md2json(taskFile([
    'created: 2026-01-01',
    'updated: 2026-01-02',
    'started: 2026-01-03',
    'completed: 2026-01-04',
    'due: 2026-01-05',
    'plannedStart: 2026-01-06',
    'plannedFinish: 2026-01-07',
    'progress: 0.5'
  ].join('\n')));

  assert.strictEqual(task.metadata.created.toISOString().substr(0, 10), '2026-01-01');
  assert.strictEqual(task.metadata.updated.toISOString().substr(0, 10), '2026-01-02');
  assert.strictEqual(task.metadata.started.toISOString().substr(0, 10), '2026-01-03');
  assert.strictEqual(task.metadata.completed.toISOString().substr(0, 10), '2026-01-04');
  assert.strictEqual(task.metadata.due.toISOString().substr(0, 10), '2026-01-05');
  assert.strictEqual(task.metadata.plannedStart.toISOString().substr(0, 10), '2026-01-06');
  assert.strictEqual(task.metadata.plannedFinish.toISOString().substr(0, 10), '2026-01-07');
  assert.strictEqual(task.metadata.progress, 0.5);
});

QUnit.test('md2json should reject an unparseable comment date', assert => {
  assert.throws(
    () => parseTask.md2json('# Test Task\n\n## Comments\n\n- date: not-a-date\n  Some comment'),
    /comments must contain a list/
  );
});

QUnit.test('md2json should reject an unparseable history event date', assert => {
  assert.throws(
    () => parseTask.md2json('# Test Task\n\n## History\n\n- date: not-a-date\n  type: created'),
    /unable to parse history event date/
  );
});

QUnit.test('md2json should reject non-numeric history progress values', assert => {
  assert.throws(
    () => parseTask.md2json(
      '# Test Task\n\n## History\n\n- date: 2026-01-01\n  type: progress\n  fromProgress: not-a-number'
    ),
    /history event fromProgress value is not numeric/
  );
  assert.throws(
    () => parseTask.md2json(
      '# Test Task\n\n## History\n\n- date: 2026-01-01\n  type: progress\n  toProgress: not-a-number'
    ),
    /history event toProgress value is not numeric/
  );
});

const invalidJson = [
  {
    name: 'null data',
    json: null,
    error: /data is null or empty/
  },
  {
    name: 'non-object data',
    json: 'a string',
    error: /data is not an object/
  },
  {
    name: 'data with no name',
    json: { description: 'no name here' },
    error: /data object is missing name/
  },
  {
    name: 'metadata with an invalid type',
    json: { name: 'Test Task', metadata: { due: 123 } },
    error: /Unable to build task/
  }
];

QUnit.test('json2md should reject invalid task objects', assert => {
  for (const testCase of invalidJson) {
    assert.throws(
      () => parseTask.json2md(testCase.json),
      testCase.error,
      `should reject ${testCase.name}`
    );
  }
});

QUnit.test('json2md should keep history keys it does not recognise', assert => {
  const md = parseTask.json2md({
    name: 'Test Task',
    metadata: {},
    subTasks: [],
    relations: [],
    comments: [],
    history: [
      {
        date: new Date('2026-01-01T00:00:00.000Z'),
        type: 'created',
        column: 'Backlog',
        somethingNew: 'from a newer version'
      }
    ]
  });

  assert.equal(md.indexOf('somethingNew: from a newer version') !== -1, true);
});
