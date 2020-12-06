const parseIndex = require('../../lib/parse-index.js');

QUnit.module('Index markdown to JSON conversion');

const TEST_NAME = 'Test Name';
const TEST_DESCRIPTION = 'Test description...';
const TEST_COLUMN_1 = 'Column 1';
const TEST_COLUMN_2 = 'Column 2';
const TEST_TASK_1 = 'Task-1';
const TEST_TASK_2 = 'Task-2';

const invalidCases = [
  {
    md: null,
    error: /data is null or empty/
  },
  {
    md: '',
    error: /data is null or empty/
  },
  {
    md: 1,
    error: /data is not a string/
  },
  {
    md: '#',
    error: /invalid markdown/
  },
  {
    md: 'test',
    error: /data is missing a name heading/
  },
  {
    md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}

## Options

Invalid options
`,
    error: /instance is not of a type\(s\) object/
  },
  {
    md: `
# ${TEST_NAME}

## ${TEST_COLUMN_1}

Invalid column contents
`,
    error: new RegExp(`column "${TEST_COLUMN_1}" must contain a list`)
  }
];

const validCases = [
  {
    md: `
# ${TEST_NAME}
`,
    json: {
      name: TEST_NAME,
      description: '',
      options: {},
      columns: {}
    }
  },
  {
    md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}
`,
    json: {
      name: TEST_NAME,
      description: TEST_DESCRIPTION,
      options: {},
      columns: {}
    }
  },
  {
    md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}

## Options

\`\`\`
validOptions: test
\`\`\`
`,
    json: {
      name: TEST_NAME,
      description: TEST_DESCRIPTION,
      options: {
        validOptions: 'test'
      },
      columns: {}
    }
  },
  {
    md: `
# ${TEST_NAME}

## Options

\`\`\`yaml
validOptions: test
\`\`\`
`,
    json: {
      name: TEST_NAME,
      description: '',
      options: {
        validOptions: 'test'
      },
      columns: {}
    }
  },
  {
    md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}

## Options

validOptions: test
`,
    json: {
      name: TEST_NAME,
      description: TEST_DESCRIPTION,
      options: {
        validOptions: 'test'
      },
      columns: {}
    }
  },
  {
    md: `
# ${TEST_NAME}

## ${TEST_COLUMN_1}
`,
    json: {
      name: TEST_NAME,
      description: '',
      options: {},
      columns: {
        [TEST_COLUMN_1]: []
      }
    }
  },
  {
    md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}

## ${TEST_COLUMN_1}
- ${TEST_TASK_1}
- ${TEST_TASK_2}
`,
    json: {
      name: TEST_NAME,
      description: TEST_DESCRIPTION,
      options: {},
      columns: {
        [TEST_COLUMN_1]: [
          TEST_TASK_1,
          TEST_TASK_2
        ]
      }
    }
  },
  {
    md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}

## ${TEST_COLUMN_1}
- [${TEST_TASK_1}](${TEST_TASK_1}.md)
- [${TEST_TASK_2}](${TEST_TASK_2}.md)

## ${TEST_COLUMN_2}
- [${TEST_TASK_1}](${TEST_TASK_1}.md)
- ${TEST_TASK_2}
`,
    json: {
      name: TEST_NAME,
      description: TEST_DESCRIPTION,
      options: {},
      columns: {
        [TEST_COLUMN_1]: [
          TEST_TASK_1,
          TEST_TASK_2
        ],
        [TEST_COLUMN_2]: [
          TEST_TASK_1,
          TEST_TASK_2
        ]
      }
    }
  }
];

QUnit.test('Test index to json conversion with valid markdown', assert => {
  validCases.forEach((validCase, i) => {
    assert.deepEqual(parseIndex.md2json(validCase.md), validCase.json, `Failed on valid case ${i + 1}`);
  });
});

QUnit.test('Test index to json conversion with invalid markdown', assert => {
  invalidCases.forEach((invalidCase, i) => {
    assert.throws(() => { parseIndex.md2json(invalidCase.md); }, invalidCase.error, `Failed on invalid case ${i + 1}`);
  });
});
