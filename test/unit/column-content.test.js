const parseIndex = require('../../src/parse-index');

QUnit.module('Column content preservation tests');

/**
 * Build an index markdown string with a single column containing the specified lines
 * @param {string} columnBody
 * @return {string}
 */
function indexWith(columnBody) {
  return `# Test Project\n\n## Column 1\n\n${columnBody}\n`;
}

QUnit.test('A list item that is not a link should not be a task', assert => {
  const index = parseIndex.md2json(indexWith('- [task-1](tasks/task-1.md)\n- Buy milk'));

  assert.deepEqual(index.columns['Column 1'], ['task-1']);
  assert.deepEqual(index.columnContent['Column 1'], [
    { position: 1, text: 'Buy milk', raw: '- Buy milk' }
  ]);
});

QUnit.test('An index with no extra content should have no columnContent', assert => {
  const index = parseIndex.md2json(indexWith('- [task-1](tasks/task-1.md)'));

  assert.notOk('columnContent' in index);
});

QUnit.test('Checkbox items should be content rather than tasks', assert => {
  const index = parseIndex.md2json(indexWith('- [ ] Buy milk\n- [x] Call Dave'));

  assert.deepEqual(index.columns['Column 1'], []);
  assert.deepEqual(
    index.columnContent['Column 1'].map(entry => entry.raw),
    ['- [ ] Buy milk', '- [x] Call Dave']
  );
});

QUnit.test('Tasks after a different bullet character should still be tracked', assert => {

  // A single line using another bullet splits the column into several markdown lists. Only reading
  // the first one silently dropped every task after it, and dropped them from the file on the next
  // save as well
  const index = parseIndex.md2json(indexWith(
    '- [task-1](tasks/task-1.md)\n* a note\n- [task-2](tasks/task-2.md)'
  ));

  assert.deepEqual(index.columns['Column 1'], ['task-1', 'task-2']);
  assert.deepEqual(index.columnContent['Column 1'], [
    { position: 1, text: 'a note', raw: '* a note' }
  ]);
});

QUnit.test('Content that is not a list should be preserved as well', assert => {
  const index = parseIndex.md2json(indexWith(
    '- [task-1](tasks/task-1.md)\n\nA note paragraph\n\n- [task-2](tasks/task-2.md)'
  ));

  assert.deepEqual(index.columns['Column 1'], ['task-1', 'task-2']);
  assert.deepEqual(index.columnContent['Column 1'], [
    { position: 1, text: 'A note paragraph', raw: 'A note paragraph', block: true }
  ]);
});

QUnit.test('A column containing no task links at all should parse', assert => {
  const index = parseIndex.md2json(indexWith('Just some prose'));

  assert.deepEqual(index.columns['Column 1'], []);
  assert.equal(index.columnContent['Column 1'][0].text, 'Just some prose');
});

QUnit.test('Preserved content should be written back where it was found', assert => {
  const md = indexWith(
    '- [task-1](tasks/task-1.md)\n* a note\n- Buy milk\n- [task-2](tasks/task-2.md)\n- [ ] Call Dave'
  );

  assert.equal(parseIndex.json2md(parseIndex.md2json(md)), md);
});

QUnit.test('Writing an index should be idempotent with mixed content', assert => {
  const md = indexWith(
    '- [task-1](tasks/task-1.md)\n\nA note paragraph\n\n- Buy milk\n- [task-2](tasks/task-2.md)'
  );
  const once = parseIndex.json2md(parseIndex.md2json(md));

  assert.equal(parseIndex.json2md(parseIndex.md2json(once)), once);
});

QUnit.test('A position past the end of a column should be clamped', assert => {
  const index = parseIndex.md2json(indexWith('- [task-1](tasks/task-1.md)\n- Buy milk'));

  // The tasks the position was recorded against have gone, so the line has nowhere to be except the
  // end of the column it was written in
  index.columns['Column 1'] = [];

  assert.equal(parseIndex.json2md(index), indexWith('- Buy milk'));
});

QUnit.test('Content in a column with no tasks should be written back', assert => {
  const md = indexWith('- Buy milk\n- Call Dave');

  assert.equal(parseIndex.json2md(parseIndex.md2json(md)), md);
});

QUnit.test('An index object with no columnContent should still build', assert => {
  assert.equal(
    parseIndex.json2md({
      name: 'Test Project',
      description: '',
      options: {},
      columns: { 'Column 1': ['task-1'] }
    }),
    indexWith('- [task-1](tasks/task-1.md)')
  );
});
