const parseTask = require('../../src/parse-task.js');

QUnit.module('Task markdown to JSON conversion tests');

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

${TEST_DESCRIPTION_1}

## Metadata

Invalid metadata
`,
    error: /instance is not of a type\(s\) object/
  },
  {
    md: `
# ${TEST_NAME}

## Sub-tasks

Invalid sub-tasks content
`,
  error: /sub-tasks must contain a list/
  },
  {
    md: `
# ${TEST_NAME}

## Relations

Invalid relations content
`,
    error: /relations must contain a list/
  },
  {
    md: `
# ${TEST_NAME}

## Metadata

created: test
`,
    error: /unable to parse created date/
  },
  {
    md: `
# ${TEST_NAME}

## Metadata

updated: test
`,
    error: /unable to parse updated date/
  },
  {
    md: `
# ${TEST_NAME}

## Metadata

started: test
`,
    error: /unable to parse started date/
  },
  {
    md: `
# ${TEST_NAME}

## Metadata

completed: test
`,
    error: /unable to parse completed date/
  },
  {
    md: `
# ${TEST_NAME}

## Metadata

due: test
`,
    error: /unable to parse due date/
  }
];

const validCases = [
  {
    md: `
# ${TEST_NAME}
`,
    json: {
      id: TEST_ID,
      name: TEST_NAME,
      description: '',
      metadata: {},
      subTasks: [],
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      relations: [],
      comments: []
    }
  },
  {
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
      ],
      comments: []
    }
  },
  {
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
      ],
      comments: []
    }
  }
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
