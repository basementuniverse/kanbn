const parseMarkdown = require('../../src/parse-markdown.js');

QUnit.module('General markdown to JSON conversion tests');

const invalidCases = [
  {
    md: undefined,
    error: /data is null, undefined or empty/
  },
  {
    md: null,
    error: /data is null, undefined or empty/
  },
  {
    md: '',
    error: /data is null, undefined or empty/
  },
  {
    md: 1,
    error: /data is not a string/
  },
  {
    md: ' ',
    error: /data is an empty string/
  },
  {
    md: '\n',
    error: /data is an empty string/
  }
];

const validCases = [
  {
    md: `#`,
    json: {}
  },
  {
    md: `#  `,
    json: {}
  },
  {
    md: `
# Title
`,
    json: {
      'Title': {
        heading: '# Title',
        content: ''
      }
    }
  },
  {
    md: `
# Title 1

Content 1

## Title 2

Content 2

### Title 3

Content 3
`,
    json: {
      'Title 1': {
        heading: '# Title 1',
        content: 'Content 1'
      },
      'Title 2': {
        heading: '## Title 2',
        content: 'Content 2'
      },
      'Title 3': {
        heading: '### Title 3',
        content: 'Content 3'
      }
    }
  }
];

QUnit.test('Test markdown to json conversion with valid markdown', assert => {
  validCases.forEach((validCase, i) => {
    assert.deepEqual(parseMarkdown(validCase.md), validCase.json, `Failed on valid case ${i + 1}`);
  });
});

QUnit.test('Test markdown to json conversion with invalid markdown', assert => {
  invalidCases.forEach((invalidCase, i) => {
    assert.throws(() => { parseMarkdown(invalidCase.md); }, invalidCase.error, `Failed on invalid case ${i + 1}`);
  });
});
