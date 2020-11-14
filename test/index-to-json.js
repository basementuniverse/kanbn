const { assert } = require('qunit');

const index = require('../lib/parse-index.js');

QUnit.module('Index to JSON conversion');

const CASE_1 = `
# Project name

Project description

## Options
\`\`\`yml
option1: a
\`\`\`

## Column1

- task-id-1
- task-id-2

## Column2

- task-id-3
`;

const CASE_2 = `
# Project name

## Options

\`\`\`
option1: a
\`\`\`

## Column1

- task-id-1
- task-id-2

## Column2

- task-id-3
`;

const CASE_3 = `
# Project name

## Column1
- task-id-1

- task-id-2

## Column2
- task-id-3
`;

const CASE_4 = `
# Project name

## Column1

- task-id-1

## Column2
`;

const CASE_5 = `
# Project name
`;

const CASE_6 = ``;

const CASE_7 = `
# Project name

## Column1

Some text here...
`;

const CASE_8 = `
Some text here...
`;

const validCases = [
  {
    data: CASE_1,
    expected: {
      title: 'Project name',
      description: 'Project description',
      options: { option1: 'a' },
      columns: { Column1: [ 'task-id-1', 'task-id-2' ], Column2: [ 'task-id-3' ] }
    }
  },
  {
    data: CASE_2,
    expected: {
      title: 'Project name',
      description: '',
      options: { option1: 'a' },
      columns: { Column1: [ 'task-id-1', 'task-id-2' ], Column2: [ 'task-id-3' ] }
    }
  },
  {
    data: CASE_3,
    expected: {
      title: 'Project name',
      description: '',
      options: {},
      columns: { Column1: [ 'task-id-1', 'task-id-2' ], Column2: [ 'task-id-3' ] }
    }
  },
  {
    data: CASE_4,
    expected: {
      title: 'Project name',
      description: '',
      options: {},
      columns: { Column1: [ 'task-id-1' ], Column2: [] }
    }
  },
  {
    data: CASE_5,
    expected: {
      title: 'Project name',
      description: '',
      options: {},
      columns: {}
    }
  }
];

const invalidCases = [
  CASE_6,
  CASE_7,
  CASE_8
];

QUnit.test('Test index to json conversion with valid markdown', assert => {
  validCases.forEach(validCase => {
    assert.deepEqual(index.indexToJson(validCase.data), validCase.expected);
  });
});

QUnit.test('Test index to json conversion with invalid markdown', assert => {
  invalidCases.forEach(invalidCase => {
    assert.throws(() => { index.indexToJson(invalidCase); }, /Unable to parse index/);
  });
});
