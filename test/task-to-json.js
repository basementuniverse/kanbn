const { assert } = require('qunit');

const task = require('../lib/parse-task.js');

QUnit.module('Task to JSON conversion');

const CASE_1 = `
# Task Title

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

## Metadata

due: null
tags:
  - tag1
  - tag2
  - tag3

## Sub-tasks

- [ ] this is a sub-task
- [x] here is a completed sub-task

## Relations

- [requires another-task](another-task.md)
- [duplicates some-other-task](some-other-task.md)
- [blocks this-task](this-task.md)

## More stuff

Even more data!
`;

const CASE_2 = `
# Task Title

This is a *task* description

## Metadata

due: null
tags:
  - tag1
  - tag2
  - tag3
`;

const CASE_3 = `
# Task Title

This is a *task* description
`;

const CASE_4 = `
# Task Title
`;

const CASE_5 = `
Some text...
`;

const CASE_6 = ``;

const validCases = [
  {
    data: CASE_1,
    expected: {
      title: 'Task Title',
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
        due: null,
        tags: [ 'tag1', 'tag2', 'tag3' ]
      },
      subTasks: [
        { text: 'this is a sub-task', checked: false },
        { text: 'here is a completed sub-task', checked: true }
      ],
      relations: [
        { type: 'requires', task: 'another-task' },
        { type: 'duplicates', task: 'some-other-task' },
        { type: 'blocks', task: 'this-task' }
      ]
    }
  },
  {
    data: CASE_2,
    expected: {
      title: 'Task Title',
      description: 'This is a *task* description',
      metadata: {
        due: null,
        tags: [ 'tag1', 'tag2', 'tag3' ]
      },
      subTasks: [],
      relations: []
    }
  },
  {
    data: CASE_3,
    expected: {
      title: 'Task Title',
      description: 'This is a *task* description',
      metadata: {},
      subTasks: [],
      relations: []
    }
  },
  {
    data: CASE_4,
    expected: {
      title: 'Task Title',
      description: '',
      metadata: {},
      subTasks: [],
      relations: []
    }
  }
];

const invalidCases = [
  CASE_5
];

QUnit.test('Test task to json conversion with valid markdown', assert => {
  validCases.forEach(validCase => {
    assert.deepEqual(task.taskToJson(validCase.data), validCase.expected);
  });
});

QUnit.test('Test task to json conversion with invalid markdown', assert => {
  invalidCases.forEach(invalidCase => {
    assert.throws(() => { task.taskToJson(invalidCase); }, /Unable to parse task/);
  });
});
