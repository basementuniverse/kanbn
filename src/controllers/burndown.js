const kanbn = require('../main');
const utility = require('../utility');
const asciichart = require('asciichart');
const Spinner = require('cli-spinner').Spinner;
const term = require('terminal-kit').terminal;

module.exports = async args => {
  // TODO burndown controller
  // console.log(term.width);
  const PADDING = '     ';
  console.log(asciichart.plot(
    (new Array(term.width - (PADDING.length + 1))).fill(null).map((v, i) => Math.floor(Math.sin(i / 4) * 10)),
    {
      offset: 2,
      padding: PADDING,
      format: x => (PADDING + x.toFixed(0)).slice(-PADDING.length),
      colors: [
        asciichart.green,
        asciichart.blue,
        asciichart.default,
        undefined,
      ]
    }
  ));
};
