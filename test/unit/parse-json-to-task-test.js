const parseTask = require('../../lib/parse-task.js');

QUnit.module('JSON to Task conversion');

const CASE_1 = `
# Task Name

This is a *task* description

It has some code:

\`\`\`js
const wibble = 1;
\`\`\`

And a list:

- one
- two
- three

## This task has a sub-heading

More data

### And a sub-sub-heading

And more data...

## More stuff

Even more data!

## Metadata

\`\`\`yaml
tags:
  - tag1
  - tag2
  - tag3
\`\`\`

## Sub-tasks

- [ ] this is a sub-task
- [x] here is a completed sub-task

## Relations

- [requires another-task](another-task.md)
- [duplicates some-other-task](some-other-task.md)
- [blocks this-task](this-task.md)
`;

const CASE_2 = `
# Task Name

This is a *task* description

## Metadata

\`\`\`yaml
tags:
  - tag1
  - tag2
  - tag3
\`\`\`
`;

const CASE_3 = `
# Task Name

This is a *task* description
`;

const CASE_4 = `
# Task Name
`;

const CASE_5 = `
Some text...
`;

const CASE_6 = ``;

const validCases = [
  {
    data: {
      name: 'Task Name',
      description: 'This is a *task* description\n' +
        '\n' +
        'It has some code:\n' +
        '\n' +
        '```js\n' +
        'const wibble = 1;\n' +
        '```\n' +
        '\n' +
        'And a list:\n' +
        '\n' +
        '- one\n' +
        '- two\n' +
        '- three\n' +
        '\n' +
        '## This task has a sub-heading\n' +
        '\n' +
        'More data\n' +
        '\n' +
        '### And a sub-sub-heading\n' +
        '\n' +
        'And more data...\n' +
        '\n' +
        '## More stuff\n' +
        '\n' +
        'Even more data!',
      metadata: {
        tags: [ 'tag1', 'tag2', 'tag3' ]
      },
      subTasks: [
        { text: 'this is a sub-task', completed: false },
        { text: 'here is a completed sub-task', completed: true }
      ],
      relations: [
        { type: 'requires', task: 'another-task' },
        { type: 'duplicates', task: 'some-other-task' },
        { type: 'blocks', task: 'this-task' }
      ]
    },
    expected: CASE_1
  },
  {
    data: {
      name: 'Task Name',
      description: 'This is a *task* description',
      metadata: {
        tags: [ 'tag1', 'tag2', 'tag3' ]
      },
      subTasks: [],
      relations: []
    },
    expected: CASE_2
  },
  {
    data: {
      name: 'Task Name',
      description: 'This is a *task* description',
      metadata: {},
      subTasks: [],
      relations: []
    },
    expected: CASE_3
  },
  {
    data: {
      name: 'Task Name',
      description: '',
      metadata: {},
      subTasks: [],
      relations: []
    },
    expected: CASE_4
  }
];

QUnit.test('Test json to task conversion with valid json', assert => {
  validCases.forEach(validCase => {
    assert.equal(parseTask.json2md(validCase.data), validCase.expected.trimStart());
  });
});
