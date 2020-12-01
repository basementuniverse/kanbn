const parseIndex = require('../../lib/parse-index.js');

QUnit.module('Index markdown to JSON conversion');

const TEST_NAME = 'Test Name';
const TEST_DESCRIPTION = 'Test description...';
const TEST_COLUMN_1 = 'Column 1';
const TEST_COLUMN_2 = 'Column 2';
const TEST_TASK_1 = 'Task-1';
const TEST_TASK_2 = 'Task-2';

// Invalid case 1: data is null
const INVALID_1 = {
  md: null,
  error: /data is null or empty/
};

// Invalid case 2: data is an empty string
const INVALID_2 = {
  md: '',
  error: /data is null or empty/
};

// Invalid case 3: data is not a string
const INVALID_3 = {
  md: 1,
  error: /data is not a string/
};

// Invalid case 4: data is missing a name
const INVALID_4 = {
  md: 'test',
  error: /data is missing a name heading/
};

// Invalid case 5: options can't be parsed as an object
const INVALID_5 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION}

## Options

Invalid options
`,
  error: /instance is not of a type\(s\) object/
};

// Invalid case 6: column doesn't contain a list
const INVALID_6 = {
  md: `
# ${TEST_NAME}

## ${TEST_COLUMN_1}

Invalid column contents
`,
  error: new RegExp(`column "${TEST_COLUMN_1}" must contain a list`)
};

// Valid case 1: data only contains a name
const VALID_1 = {
  md: `
# ${TEST_NAME}
`,
  json: {
    name: TEST_NAME,
    description: '',
    options: {},
    columns: {}
  }
};

// Valid case 2: data contains a name and description
const VALID_2 = {
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
};

// Valid case 3: data contains a name, description and options inside a code block
const VALID_3 = {
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
};

// Valid case 4: data contains a name and options inside a code block with language annotation
const VALID_4 = {
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
};

// Valid case 5: data contains a name, description and options not inside a code block
const VALID_5 = {
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
};

// Valid case 6: data contains a name and a column with no tasks
const VALID_6 = {
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
};

// Valid case 7: data contains a name, description and a column with tasks as strings
const VALID_7 = {
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
};

// Valid case 8: data contains a name, description and multiple columns with tasks as links and strings
const VALID_8 = {
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
};

const invalidCases = [
  INVALID_1,
  INVALID_2,
  INVALID_3,
  INVALID_4,
  INVALID_5,
  INVALID_6
];

const validCases = [
  VALID_1,
  VALID_2,
  VALID_3,
  VALID_4,
  VALID_5,
  VALID_6,
  VALID_7,
  VALID_8
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
