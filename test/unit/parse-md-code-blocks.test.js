const parseMarkdown = require('../../src/parse-markdown');
const parseIndex = require('../../src/parse-index');
const parseTask = require('../../src/parse-task');

QUnit.module('Markdown heading detection tests');

/**
 * Get the heading titles that parseMarkdown found, in order
 * @param {string} md
 * @return {string[]}
 */
function titles(md) {
  return Object.keys(parseMarkdown(md));
}

QUnit.test('should not treat a comment inside a fenced code block as a heading', async assert => {
  assert.deepEqual(titles('# Test Name\n\n```bash\n# install deps\nnpm install\n```\n'), ['Test Name']);
  assert.deepEqual(titles('# Test Name\n\n```python\n# entry point\ndef main():\n    pass\n```\n'), ['Test Name']);
  assert.deepEqual(titles('# Test Name\n\n~~~\n# tilde fenced\n~~~\n'), ['Test Name']);
});

QUnit.test('should keep the contents of a fenced code block intact', async assert => {
  assert.deepEqual(
    parseMarkdown('# Test Name\n\n```bash\n# install deps\nnpm install\n```\n'),
    {
      'Test Name': {
        heading: '# Test Name',
        content: '```bash\n# install deps\nnpm install\n```'
      }
    }
  );
});

QUnit.test('should resume finding headings after a code block closes', async assert => {
  assert.deepEqual(
    titles('# Test Name\n\n```\n# a\n```\n\n## Section A\n\n```\n# b\n```\n\n## Section B\n'),
    ['Test Name', 'Section A', 'Section B']
  );
});

QUnit.test('should only close a code block with a matching fence', async assert => {

  // A backtick fence doesn't close a tilde block
  assert.deepEqual(titles('# Test Name\n\n~~~\n```\n# nope\n~~~\n\n## Section A\n'), ['Test Name', 'Section A']);

  // A shorter fence doesn't close a longer block, so a fence can be nested in a code block
  assert.deepEqual(
    titles('# Test Name\n\n````\n```\n# nope\n```\n````\n\n## Section A\n'),
    ['Test Name', 'Section A']
  );

  // A closing fence can't carry an info string
  assert.deepEqual(
    titles('# Test Name\n\n```js\n# nope\n```js\n# still nope\n```\n\n## Section A\n'),
    ['Test Name', 'Section A']
  );
});

QUnit.test('should handle indented and non-fence backtick lines', async assert => {

  // Up to 3 leading spaces is still a fence
  assert.deepEqual(titles('# Test Name\n\n   ```\n# nope\n   ```\n\n## Section A\n'), ['Test Name', 'Section A']);

  // At 4 spaces it's an indented code block, which can't contain a heading anyway
  assert.deepEqual(titles('# Test Name\n\n    ```\n    code\n\n## Section A\n'), ['Test Name', 'Section A']);

  // A backtick fence's info string can't contain a backtick, so this line opens nothing
  assert.deepEqual(titles('# Test Name\n\n```a`b\n\n## Section A\n'), ['Test Name', 'Section A']);
});

QUnit.test('should not put a carriage return into headings parsed from a CRLF file', async assert => {
  assert.deepEqual(
    parseMarkdown('# Test Name\r\n\r\nTest description...\r\n\r\n## Section A\r\n\r\nContent\r\n'),
    {
      'Test Name': { heading: '# Test Name', content: 'Test description...' },
      'Section A': { heading: '## Section A', content: 'Content' }
    }
  );
});

QUnit.test('should merge repeated headings instead of overwriting them', async assert => {
  assert.deepEqual(
    parseMarkdown('# Test Name\n\n## Notes\n\nfirst\n\n## Notes\n\nsecond\n'),
    {
      'Test Name': { heading: '# Test Name', content: '' },
      'Notes': { heading: '## Notes', content: 'first\n\n## Notes\n\nsecond' }
    }
  );
});

QUnit.module('Task parsing markdown edge-case tests');

QUnit.test('should round-trip a task containing code blocks without mangling them', async assert => {
  const md = `# Test Name

Run the following:

\`\`\`bash
# install deps
npm install
\`\`\`

\`\`\`python
# entry point
def main():
    pass
\`\`\`

## Sub-tasks

- [ ] Test sub-task
`;
  const task = parseTask.md2json(md);
  assert.equal(
    task.description,
    'Run the following:\n\n```bash\n# install deps\nnpm install\n```\n\n```python\n# entry point\ndef main():\n    pass\n```'
  );
  assert.deepEqual(task.subTasks, [{ text: 'Test sub-task', completed: false }]);
  assert.equal(parseTask.json2md(task), md, 'the task file comes back byte-identical');
});

QUnit.test('should keep the text of a level-1 heading written into a description', async assert => {
  const task = parseTask.md2json('# Test Name\n\n# Another heading\n\nTest description...\n');
  assert.equal(task.description, '# Another heading\n\nTest description...');
});

QUnit.test('should keep both halves of a repeated description heading', async assert => {
  const task = parseTask.md2json('# Test Name\n\n## Notes\n\nfirst\n\n## Notes\n\nsecond\n');
  assert.equal(task.description, '## Notes\n\nfirst\n\n## Notes\n\nsecond');
});

QUnit.test('should only treat level-2 headings as reserved sections', async assert => {
  const task = parseTask.md2json('# Test Name\n\n### Sub-tasks\n\n- [ ] Not a sub-task\n');
  assert.deepEqual(task.subTasks, [], 'a level-3 heading is description content');
  assert.equal(task.description, '### Sub-tasks\n\n- [ ] Not a sub-task');

  const comments = parseTask.md2json('# Test Name\n\n# Comments\n\nProse, not a list\n');
  assert.deepEqual(comments.comments, [], 'a level-1 heading is description content');
  assert.equal(comments.description, '# Comments\n\nProse, not a list');

  const real = parseTask.md2json('# Test Name\n\n## Sub-tasks\n\n- [x] A real sub-task\n');
  assert.deepEqual(real.subTasks, [{ text: 'A real sub-task', completed: true }]);
});

QUnit.module('Index parsing markdown edge-case tests');

QUnit.test('should not create a column from a comment inside a code block', async assert => {
  const index = parseIndex.md2json('# Test Board\n\n## Todo\n\n- [task-1](tasks/task-1.md)\n\n```\n# not a column\n```\n');
  assert.deepEqual(Object.keys(index.columns), ['Todo']);
  assert.deepEqual(index.columns['Todo'], ['task-1']);
});

QUnit.test('should not lose the tasks in the first of two identically named columns', async assert => {
  const index = parseIndex.md2json(
    '# Test Board\n\n## Todo\n\n- [task-1](tasks/task-1.md)\n\n## Todo\n\n- [task-2](tasks/task-2.md)\n'
  );
  assert.deepEqual(index.columns['Todo'], ['task-1', 'task-2']);
});

QUnit.test('should keep a sub-heading in the project description out of the columns', async assert => {
  const md = `# Test Board

Some description.

### A note

More description.

## Todo

- [task-1](tasks/task-1.md)
`;
  const index = parseIndex.md2json(md);
  assert.deepEqual(Object.keys(index.columns), ['Todo'], 'a level-3 heading is not a column');
  assert.equal(index.description, 'Some description.\n\n### A note\n\nMore description.');
  assert.equal(parseIndex.json2md(index), md, 'the index file comes back byte-identical');
});

QUnit.test('should keep a code block in the project description out of the columns', async assert => {
  const index = parseIndex.md2json(
    '# Test Board\n\n```\n# not a column\n```\n\n## Todo\n\n- [task-1](tasks/task-1.md)\n'
  );
  assert.deepEqual(Object.keys(index.columns), ['Todo']);
  assert.equal(index.description, '```\n# not a column\n```');
});
