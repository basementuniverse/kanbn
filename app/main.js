const kanbn = require('../lib/main');
const utility = require('../lib/utility');
const board = require('./board');
const Spinner = require('cli-spinner').Spinner;
const term = require('terminal-kit').terminal;

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }

  // Get the index and make sure it has some columns
  let index;
  try {
    index = await kanbn.getIndex();
  } catch (error) {
    utility.error(error, true);
  }
  const columnNames = Object.keys(index.columns);
  if (!columnNames.length) {
    utility.error('No columns defined in the index\nTry running {b}kanbn init -c "column name"{b}', true);
  }

  // Initialise terminal interface
  term.grabInput();
  term.fullscreen();
  board.initialise(index);

  // Handle input
  term.on('key', (key, matches, data) => {
    // console.log("'key' event:", key);

    // Detect CTRL-C and exit
    if (key === 'CTRL_C') {
      term.fullscreen(false);
      process.exit();
    }
  });

  // Handle resize
  term.on('resize', (width, height) => {
    console.log(`${width}, ${height}`);
  });

  // Show kanbn board
  board.show(index);
};
