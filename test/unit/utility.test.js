const utility = require('../../src/utility');

QUnit.module('utility tests', {
  before() {
    require('../qunit-throws-async');
  }
});

QUnit.test('paramCase() should convert strings to param-case', async assert => {
  assert.equal(utility.paramCase('PascalCase'), 'pascal-case');
  assert.equal(utility.paramCase('camelCase'), 'camel-case');
  assert.equal(utility.paramCase('snake_case'), 'snake-case');
  assert.equal(utility.paramCase('No Case'), 'no-case');
  assert.equal(utility.paramCase('With 2 numbers 3'), 'with-2-numbers-3');
  assert.equal(utility.paramCase('Multiple  spaces'), 'multiple-spaces');
  assert.equal(utility.paramCase('Tab\tCharacter'), 'tab-character');
  assert.equal(utility.paramCase('New\nLine'), 'new-line');
  assert.equal(utility.paramCase('Punctuation, Characters'), 'punctuation-characters');
  assert.equal(
    utility.paramCase('M!o?r.e, @p:u;n|c\\t/u"a\'t`i£o$n% ^c&h*a{r}a[c]t(e)r<s> ~l#i+k-e= _t¬hese'),
    'm-o-r-e-p-u-n-c-t-u-a-t-i-o-n-c-h-a-r-a-c-t-e-r-s-l-i-k-e-t-hese'
  );
  assert.equal(utility.paramCase('This string ends with punctuation!'), 'this-string-ends-with-punctuation');
  assert.equal(utility.paramCase('?This string starts with punctuation'), 'this-string-starts-with-punctuation');
  assert.equal(
    utility.paramCase('#This string has punctuation at both ends&'),
    'this-string-has-punctuation-at-both-ends'
  );
  assert.equal(utility.paramCase('軟件 測試'), '軟件-測試');
  assert.equal(utility.paramCase('実験 試し'), '実験-試し');
  assert.equal(utility.paramCase('יקספּערמענאַל פּרובירן'), 'יקספּערמענאַל-פּרובירן');
  assert.equal(utility.paramCase('я надеюсь, что это сработает'), 'я-надеюсь-что-это-сработает');
});

QUnit.test('strArg() should convert arguments into strings', async assert => {
  assert.equal(utility.strArg('test'), 'test');
  assert.equal(utility.strArg(['test']), 'test');
  assert.equal(utility.strArg(['test1', 'test2']), 'test2');
  assert.equal(utility.strArg(['test1', 'test2'], true), 'test1,test2');
});

QUnit.test('arrayArg() should convert arguments into arrays', async assert => {
  assert.deepEqual(utility.arrayArg('test'), ['test']);
  assert.deepEqual(utility.arrayArg(['test']), ['test']);
});

QUnit.test('trimLeftEscapeCharacters() should remove escape characters from the beginning of a string', async assert => {
  assert.equal(utility.trimLeftEscapeCharacters('test'), 'test');
  assert.equal(utility.trimLeftEscapeCharacters('/test'), 'test');
  assert.equal(utility.trimLeftEscapeCharacters('\\test'), 'test');
});

QUnit.test('compareDates() should compare dates using only the date part and ignoring time', async assert => {
  assert.equal(utility.compareDates(
    new Date('2021-05-15T19:29:01+00:00'),
    new Date('2021-05-15T21:59:01+00:00')
  ), true);
  assert.equal(utility.compareDates(
    new Date('2021-05-15T19:29:01+00:00'),
    new Date('2021-05-16T21:59:01+00:00')
  ), false);
});

QUnit.test('coerceUndefined() should coerce undefined values depending on the specified type', async assert => {
  assert.equal(utility.coerceUndefined('test'), 'test');
  assert.equal(utility.coerceUndefined(2), 2);
  assert.equal(utility.coerceUndefined(undefined, 'string'), '');
  assert.equal(utility.coerceUndefined(undefined, 'int'), 0);
  assert.equal(utility.coerceUndefined(undefined), 0);
});

QUnit.test('replaceTags() should replace tags in a string with control sequences', async assert => {
  assert.equal(
    utility.replaceTags('test {b}bold{b} {b}no match {d}dim{d} {d}no match'),
    'test \x1b[1mbold\x1b[0m {b}no match \x1b[2mdim\x1b[0m {d}no match'
  );
});

QUnit.test('zip() should zip 2 arrays together', async assert => {
  assert.deepEqual(utility.zip(['a', 'b', 'c'], [1, 2, 3]), [
    ['a', 1],
    ['b', 2],
    ['c', 3]
  ]);
});
