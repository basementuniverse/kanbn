const parseIndex = require('../../src/parse-index');

QUnit.module('index parsing error tests');

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
    name: 'embedded options that are not an object',
    md: '# Test Project\n\n## Options\n\njust text',
    error: /invalid options content/
  },
  {
    name: 'options with an invalid type',
    md: '---\nhiddenColumns: not-an-array\n---\n\n# Test Project',
    error: /Unable to parse index/
  }
];

QUnit.test('md2json should reject invalid index files', assert => {
  for (const testCase of invalidMarkdown) {
    assert.throws(
      () => parseIndex.md2json(testCase.md),
      testCase.error,
      `should reject ${testCase.name}`
    );
  }
});

QUnit.test('md2json should read options from embedded markdown as well as front matter', assert => {
  const index = parseIndex.md2json([
    '---',
    'hiddenColumns:',
    '  - Column 2',
    '---',
    '',
    '# Test Project',
    '',
    '## Options',
    '',
    '```yaml',
    'startedColumns:',
    '  - Column 1',
    '```',
    '',
    '## Column 1',
    '',
    '- [task-1](tasks/task-1.md)',
    '',
    '## Column 2'
  ].join('\n'));

  assert.deepEqual(index.options.hiddenColumns, ['Column 2']);
  assert.deepEqual(index.options.startedColumns, ['Column 1']);
  assert.deepEqual(index.columns, {
    'Column 1': ['task-1'],
    'Column 2': []
  });
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
  }
];

QUnit.test('json2md should reject invalid index objects', assert => {
  for (const testCase of invalidJson) {
    assert.throws(
      () => parseIndex.json2md(testCase.json),
      testCase.error,
      `should reject ${testCase.name}`
    );
  }
});

QUnit.test('json2md can leave the options out of the index', assert => {
  const index = {
    name: 'Test Project',
    description: 'Test description',
    options: { hiddenColumns: ['Column 2'] },
    columns: { 'Column 1': [] }
  };

  assert.equal(parseIndex.json2md(index).indexOf('hiddenColumns') !== -1, true);
  assert.equal(parseIndex.json2md(index, true).indexOf('hiddenColumns'), -1);
});

QUnit.test('markdown with content before the first heading should keep it as raw content', assert => {
  const parseMarkdown = require('../../src/parse-markdown');
  const parsed = parseMarkdown('Some preamble\n\n# Title\n\nContent');

  assert.deepEqual(parsed.raw, { heading: '', content: 'Some preamble' });
  assert.deepEqual(parsed.Title, { heading: '# Title', content: 'Content' });
});
