const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const Spinner = require('cli-spinner').Spinner;
const term = require('terminal-kit').terminal;

module.exports = (() => {

  let currentIndex = null;
  let taskCache = {};

  // show spinner, load tasks into cache...

  return {
    initialise(index) {
      currentIndex = index;
    },

    show(index = null) {
      index = index ?? currentIndex;
      term.table(
        [
          ['header #1', 'header #2', 'header #3'],
          ['row #1', 'a much bigger cell, a much bigger cell, a much bigger cell... ', 'cell'],
          ['row #2', 'cell', 'a medium cell'],
          ['row #3', 'cell', 'cell'],
          ['row #4', 'cell\nwith\nnew\nlines', '^YThis ^Mis ^Ca ^Rcell ^Gwith ^Bmarkup^R^+!']
        ],
        {
          hasBorder: true,
          contentHasMarkup: true,
          borderChars: 'lightRounded',
          borderAttr: { color: 'blue' },
          textAttr: { bgColor: 'default' },
          firstCellTextAttr: { bgColor: 'blue' },
          firstRowTextAttr: { bgColor: 'yellow' },
          firstColumnTextAttr: { bgColor: 'red' },
          // width: 100,
          fit: true // Activate all expand/shrink + wordWrap
        }
      );
    }
  }
})();
