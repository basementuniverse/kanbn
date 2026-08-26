const parseTask = require('../../src/parse-task');

QUnit.module('Task history forwards-compatibility tests', {
  before() {
    require('../qunit-throws-async');
  }
});

// A task file as a future version of kanbn might write it: an event type this version doesn't
// know about, and an extra key on an event type it does
const TEST_TASK_WITH_UNKNOWN_HISTORY = `# Test Name

Test description...

## History

- type: created
  date: 2026-08-01T09:00:00.000Z
  column: Todo
- type: added
  date: 2026-08-02T09:00:00.000Z
  column: Ideas
  board: design
- type: moved
  date: 2026-08-03T09:00:00.000Z
  fromColumn: Ideas
  toColumn: Designing
  board: design
`;

QUnit.test('should parse a task containing an unknown history event type', async assert => {
  const result = parseTask.md2json(TEST_TASK_WITH_UNKNOWN_HISTORY);
  assert.equal(result.history.length, 3, 'all events are kept, including the unknown type');
  assert.equal(result.history[1].type, 'added');
  assert.equal(result.history[1].column, 'Ideas');
  assert.true(result.history[1].date instanceof Date, 'unknown event types still get a parsed date');
});

QUnit.test('should keep unknown keys on known history event types', async assert => {
  const result = parseTask.md2json(TEST_TASK_WITH_UNKNOWN_HISTORY);
  assert.equal(result.history[2].type, 'moved');
  assert.equal(result.history[2].board, 'design', 'the unrecognised "board" key survives parsing');
});

QUnit.test('should preserve unknown event types and keys through a round trip', async assert => {
  const json = parseTask.md2json(TEST_TASK_WITH_UNKNOWN_HISTORY);
  const md = parseTask.json2md(json);

  assert.true(md.includes('type: added'), 'unknown event type is written back');
  assert.true(md.includes('board: design'), 'unknown key is written back');

  // Reading what we just wrote must produce the same history
  const reparsed = parseTask.md2json(md);
  assert.deepEqual(
    reparsed.history.map(e => ({ ...e, date: e.date.toISOString() })),
    json.history.map(e => ({ ...e, date: e.date.toISOString() })),
    'history survives a full read/write/read cycle unchanged'
  );
});

QUnit.test('should still validate required fields on known event types', async assert => {
  await assert.throwsAsync(
    async () => parseTask.md2json(`# Test Name

## History

- type: moved
  date: 2026-08-03T09:00:00.000Z
  fromColumn: Todo
`),
    /moved history event is missing fromColumn or toColumn/,
    'a known event type with a missing required field is still rejected'
  );
});

QUnit.test('should still require type and date on every event', async assert => {
  await assert.throwsAsync(
    async () => parseTask.md2json(`# Test Name

## History

- date: 2026-08-03T09:00:00.000Z
  column: Todo
`),
    /history event is missing type/,
    'an event with no type is rejected regardless of tolerance'
  );
  await assert.throwsAsync(
    async () => parseTask.md2json(`# Test Name

## History

- type: added
  column: Ideas
`),
    /unable to parse history event date/,
    'an unknown event type with no date is still rejected'
  );
});
