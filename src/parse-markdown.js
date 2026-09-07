/**
 * Match an ATX heading line, e.g. `## Title`
 *
 * The heading must start at column 0. CommonMark also allows up to 3 leading spaces, but kanbn has
 * always required none, and loosening it now would start hoisting indented lines out of task files
 * that parse correctly today
 */
const HEADING_REGEX = /^(#{1,6}) (.+)$/;

/**
 * Match the opening or closing line of a fenced code block
 *
 * Up to 3 leading spaces are allowed, as in CommonMark - at 4 spaces the line is part of an indented
 * code block instead, which can't contain a heading anyway because a heading must start at column 0
 */
const FENCE_REGEX = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Find the ATX headings in a markdown document, ignoring anything inside a fenced code block
 *
 * Tracking fences is the whole reason this isn't a single regex: `# install deps` inside a ```bash
 * block is a shell comment, not a heading, and hoisting it out of the block destroys the user's code.
 * The same goes for Python comments, Ruby comments, C preprocessor directives and so on
 * @param {string} markdown
 * @return {object[]} Each heading's line, title, start index and the index its content starts at
 */
function findHeadings(markdown) {
  const headings = [];

  // The fence currently open, as { char, length }, or null if we're not inside a code block
  let fence = null;
  let index = 0;
  for (const rawLine of markdown.split('\n')) {

    // Tolerate CRLF line endings: without this the trailing carriage return ends up inside the
    // heading title, and from there inside task names and ids
    const line = rawLine.replace(/\r$/, '');
    const fenceMatch = line.match(FENCE_REGEX);
    if (fence === null) {
      if (fenceMatch && isFenceStart(fenceMatch)) {
        fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      } else {
        const headingMatch = line.match(HEADING_REGEX);
        if (headingMatch) {
          headings.push({
            heading: headingMatch[0],
            title: headingMatch[2],
            index,

            // Where this heading's content starts: the line after the heading line
            contentIndex: index + rawLine.length + 1
          });
        }
      }
    } else if (isFenceEnd(fenceMatch, fence)) {
      fence = null;
    }

    // + 1 for the newline that split() removed
    index += rawLine.length + 1;
  }
  return headings;
}

/**
 * Check if a fence line opens a code block
 *
 * A backtick fence's info string can't itself contain a backtick - ```` ```a`b ```` is a paragraph
 * containing code spans, not a code block. Tilde fences have no such restriction
 * @param {object} fenceMatch A FENCE_REGEX match
 * @return {boolean}
 */
function isFenceStart(fenceMatch) {
  return fenceMatch[1][0] !== '`' || fenceMatch[2].indexOf('`') === -1;
}

/**
 * Check if a line closes the currently open code block
 *
 * A closing fence has to use the same character as the fence that opened the block, be at least as
 * long, and carry no info string - so a ``` line doesn't close a ~~~ block, and neither does ```js
 * @param {?object} fenceMatch A FENCE_REGEX match, or null if the line isn't a fence
 * @param {object} fence The currently open fence
 * @return {boolean}
 */
function isFenceEnd(fenceMatch, fence) {
  return (
    fenceMatch !== null &&
    fenceMatch[1][0] === fence.char &&
    fenceMatch[1].length >= fence.length &&
    fenceMatch[2].trim() === ''
  );
}

module.exports = function parseMarkdown(markdown) {
  if (!markdown) {
    throw new Error('data is null, undefined or empty');
  }
  if (typeof markdown !== 'string') {
    throw new Error('data is not a string');
  }
  markdown = markdown.trim();
  if (markdown === '') {
    throw new Error('data is an empty string');
  }
  const headings = findHeadings(markdown);
  if (headings.length > 0 && headings[0].index > 0) {
    headings.unshift({
      heading: '',
      title: 'raw',
      index: 0,
      contentIndex: 0
    });
  }
  const parsed = {};
  for (let i = 0; i < headings.length; i++) {
    const content = markdown.slice(
      headings[i].contentIndex,
      i < headings.length - 1
        ? headings[i + 1].index
        : undefined
    ).trim();

    // A repeated heading title used to overwrite the earlier one, silently discarding everything
    // written under it - two `## Todo` columns meant losing every task in the first one. Merging the
    // sections keeps the content, and keeping the repeated heading line means the section still
    // looks the way the user wrote it after a read/write cycle
    if (headings[i].title in parsed) {
      parsed[headings[i].title].content = [
        parsed[headings[i].title].content,
        headings[i].heading,
        content
      ].filter(part => part !== '').join('\n\n');
      continue;
    }
    parsed[headings[i].title] = {
      heading: headings[i].heading,
      content
    };
  }
  return parsed;
};
