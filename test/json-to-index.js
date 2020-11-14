const { assert } = require('qunit');

const index = require('../lib/parse-index.js');

QUnit.module('JSON to Index conversion');

const CASE_1 = `
# Project name

Project description

## Options

\`\`\`yaml
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

\`\`\`yaml
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

## Column2

- task-id-3
`;

const CASE_5 = `
# Project name
`;

const validCases = [
  {
    data: {
      title: 'Project name',
      description: 'Project description',
      options: { option1: 'a' },
      columns: { Column1: [ 'task-id-1', 'task-id-2' ], Column2: [ 'task-id-3' ] }
    },
    expected: CASE_1
  },
  {
    data: {
      title: 'Project name',
      description: '',
      options: { option1: 'a' },
      columns: { Column1: [ 'task-id-1', 'task-id-2' ], Column2: [ 'task-id-3' ] }
    },
    expected: CASE_2
  },
  {
    data: {
      title: 'Project name',
      description: '',
      options: {},
      columns: { Column1: [ 'task-id-1', 'task-id-2' ], Column2: [ 'task-id-3' ] }
    },
    expected: CASE_3
  },
  {
    data: {
      title: 'Project name',
      description: '',
      options: {},
      columns: { Column1: [], Column2: [ 'task-id-3' ] }
    },
    expected: CASE_4
  },
  {
    data: {
      title: 'Project name',
      description: '',
      options: {},
      columns: {}
    },
    expected: CASE_5
  }
];

QUnit.test('Test json to index conversion with valid json', assert => {
  validCases.forEach(validCase => {
    assert.equal(index.jsonToIndex(validCase.data), validCase.expected.trim());
  });
});
