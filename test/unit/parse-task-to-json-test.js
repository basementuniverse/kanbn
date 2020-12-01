const parseTask = require('../../lib/parse-task.js');

QUnit.module('Task markdown to JSON conversion');

const TEST_ID = 'test-name';
const TEST_NAME = 'Test Name';
const TEST_DESCRIPTION_1 = 'Test description...';
const TEST_DESCRIPTION_2 = `This is a *test* description

It has some code:

\`\`\`js
const wibble = 1;
\`\`\`

And a list:

- one
- two
- three

## Sub-heading 1

More description

### Sub-heading 1.1

And more description...`;
const TEST_DESCRIPTION_3 = `## Sub-sub-heading 2

Some more description text...

### Sub-sub-heading 2.1

Some more description text...

#### Sub-sub-sub-heading 2.1.1

Some more description text...`;
const TEST_METADATA = `
tags:
  - tag1
  - tag2
  - tag3
`;
const TEST_METADATA_JSON = {
  tags: [
    'tag1',
    'tag2',
    'tag3'
  ]
};
const TEST_SUBTASK_1 = 'Test sub-task 1';
const TEST_SUBTASK_1_JSON = {
  text: 'Test sub-task 1',
  completed: false
};
const TEST_SUBTASK_2 = '[ ] Test sub-task 2';
const TEST_SUBTASK_2_JSON = {
  text: 'Test sub-task 2',
  completed: false
};
const TEST_SUBTASK_3 = '[x] Test sub-task 3';
const TEST_SUBTASK_3_JSON = {
  text: 'Test sub-task 3',
  completed: true
};
const TEST_RELATION_1 = 'Test relation';
const TEST_RELATION_1_JSON = {
  task: 'relation',
  type: 'Test'
};
const TEST_RELATION_2 = 'test-task-1';
const TEST_RELATION_2_JSON = {
  task: 'test-task-1',
  type: ''
};
const TEST_RELATION_3 = '[test-task-1](test-task-1.md)';
const TEST_RELATION_3_JSON = {
  task: 'test-task-1',
  type: ''
};
const TEST_RELATION_4 = '[relation-type test-task-1](test-task-1.md)';
const TEST_RELATION_4_JSON = {
  task: 'test-task-1',
  type: 'relation-type'
};
const TEST_RELATION_5 = '[relation type with spaces test-task-1](test-task-1.md)';
const TEST_RELATION_5_JSON = {
  task: 'test-task-1',
  type: 'relation type with spaces'
};

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

// Invalid case 5: metadata can't be parsed as an object
const INVALID_5 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION_1}

## Metadata

Invalid metadata
`,
  error: /instance is not of a type\(s\) object/
};

// Invalid case 6: sub-tasks doesn't contain a list
const INVALID_6 = {
  md: `
# ${TEST_NAME}

## Sub-tasks

Invalid sub-tasks content
`,
  error: /sub-tasks must contain a list/
};

// Invalid case 7: relations doesn't contain a list
const INVALID_7 = {
  md: `
# ${TEST_NAME}

## Relations

Invalid relations content
`,
  error: /relations must contain a list/
};

// Invalid case 8: metadata contains invalid created date
const INVALID_8 = {
  md: `
# ${TEST_NAME}

## Metadata

created: test
`,
  error: /unable to parse created date/
};

// Invalid case 9: metadata contains invalid updated date
const INVALID_9 = {
  md: `
# ${TEST_NAME}

## Metadata

updated: test
`,
  error: /unable to parse updated date/
};

// Invalid case 10: metadata contains invalid started date
const INVALID_10 = {
  md: `
# ${TEST_NAME}

## Metadata

started: test
`,
  error: /unable to parse started date/
};

// Invalid case 11: metadata contains invalid completed date
const INVALID_11 = {
  md: `
# ${TEST_NAME}

## Metadata

completed: test
`,
  error: /unable to parse completed date/
};

// Invalid case 12: metadata contains invalid due date
const INVALID_12 = {
  md: `
# ${TEST_NAME}

## Metadata

due: test
`,
  error: /unable to parse due date/
};

// Valid case 1: data only contains name
const VALID_1 = {
  md: `
# ${TEST_NAME}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: '',
    metadata: {},
    subTasks: [],
    relations: []
  }
};

// Valid case 2: data contains a name and basic description
const VALID_2 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION_1}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: TEST_DESCRIPTION_1,
    metadata: {},
    subTasks: [],
    relations: []
  }
};

// Valid case 3: data contains a name and description with sub-headings and markup
const VALID_3 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION_2}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: TEST_DESCRIPTION_2,
    metadata: {},
    subTasks: [],
    relations: []
  }
};

// Valid case 4: data contains a name, description and metadata inside a block block
const VALID_4 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION_2}

## Metadata

\`\`\`
${TEST_METADATA}
\`\`\`
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: TEST_DESCRIPTION_2,
    metadata: TEST_METADATA_JSON,
    subTasks: [],
    relations: []
  }
};

// Valid case 5: data contains a name and metadata inside a code block
const VALID_5 = {
  md: `
# ${TEST_NAME}

## Metadata

\`\`\`
${TEST_METADATA}
\`\`\`
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: '',
    metadata: TEST_METADATA_JSON,
    subTasks: [],
    relations: []
  }
};

// Valid case 6: data contains a name and metadata inside a code block with language annotations
const VALID_6 = {
  md: `
# ${TEST_NAME}

## Metadata

\`\`\`yaml
${TEST_METADATA}
\`\`\`
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: '',
    metadata: TEST_METADATA_JSON,
    subTasks: [],
    relations: []
  }
};

// Valid case 7: data contains a name and metadata not inside a code block
const VALID_7 = {
  md: `
# ${TEST_NAME}

## Metadata

${TEST_METADATA}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: '',
    metadata: TEST_METADATA_JSON,
    subTasks: [],
    relations: []
  }
};

// Valid case 8: data contains a name, metadata and sub-tasks
const VALID_8 = {
  md: `
# ${TEST_NAME}

## Metadata

\`\`\`
${TEST_METADATA}
\`\`\`

## Sub-tasks

- ${TEST_SUBTASK_1}
- ${TEST_SUBTASK_2}
- ${TEST_SUBTASK_3}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: '',
    metadata: TEST_METADATA_JSON,
    subTasks: [
      TEST_SUBTASK_1_JSON,
      TEST_SUBTASK_2_JSON,
      TEST_SUBTASK_3_JSON
    ],
    relations: []
  }
};

// Valid case 9: data contains a name, description and relations
const VALID_9 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION_2}

## Relations

- ${TEST_RELATION_1}
- ${TEST_RELATION_2}
- ${TEST_RELATION_3}
- ${TEST_RELATION_4}
- ${TEST_RELATION_5}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: TEST_DESCRIPTION_2,
    metadata: {},
    subTasks: [],
    relations: [
      TEST_RELATION_1_JSON,
      TEST_RELATION_2_JSON,
      TEST_RELATION_3_JSON,
      TEST_RELATION_4_JSON,
      TEST_RELATION_5_JSON
    ]
  }
};

// Valid case 10: data contains a name, description in multiple parts, sub-tasks and relations
const VALID_10 = {
  md: `
# ${TEST_NAME}

${TEST_DESCRIPTION_2}

## Metadata

\`\`\`
${TEST_METADATA}
\`\`\`

## Sub-tasks

- ${TEST_SUBTASK_1}
- ${TEST_SUBTASK_2}
- ${TEST_SUBTASK_3}

## Relations

- ${TEST_RELATION_1}
- ${TEST_RELATION_2}
- ${TEST_RELATION_3}
- ${TEST_RELATION_4}
- ${TEST_RELATION_5}

${TEST_DESCRIPTION_3}
`,
  json: {
    id: TEST_ID,
    name: TEST_NAME,
    description: `${TEST_DESCRIPTION_2}

${TEST_DESCRIPTION_3}`,
    metadata: TEST_METADATA_JSON,
    subTasks: [
      TEST_SUBTASK_1_JSON,
      TEST_SUBTASK_2_JSON,
      TEST_SUBTASK_3_JSON
    ],
    relations: [
      TEST_RELATION_1_JSON,
      TEST_RELATION_2_JSON,
      TEST_RELATION_3_JSON,
      TEST_RELATION_4_JSON,
      TEST_RELATION_5_JSON
    ]
  }
};

const invalidCases = [
  INVALID_1,
  INVALID_2,
  INVALID_3,
  INVALID_4,
  INVALID_5,
  INVALID_6,
  INVALID_7,
  INVALID_8,
  INVALID_9,
  INVALID_10,
  INVALID_11,
  INVALID_12
];

const validCases = [
  VALID_1,
  VALID_2,
  VALID_3,
  VALID_4,
  VALID_5,
  VALID_6,
  VALID_7,
  VALID_8,
  VALID_9,
  VALID_10
];

QUnit.test('Test task to json conversion with valid markdown', assert => {
  validCases.forEach((validCase, i) => {
    assert.deepEqual(parseTask.md2json(validCase.md), validCase.json, `Failed on valid case ${i + 1}`);
  });
});

QUnit.test('Test task to json conversion with invalid markdown', assert => {
  invalidCases.forEach((invalidCase, i) => {
    assert.throws(() => { parseTask.md2json(invalidCase.md); }, invalidCase.error, `Failed on invalid case ${i + 1}`);
  });
});
