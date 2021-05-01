const kanbn = require('../main');
const utility = require('../utility');
const asciichart = require('asciichart');
const term = require('terminal-kit').terminal;
const chrono = require('chrono-node');
const formatDate = require('dateformat');

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}', true);
  }
  const index = await kanbn.getIndex();

  // Get sprint numbers or names
  let sprints = null;
  if (args.sprint) {
    sprints = utility.arrayArg(args.sprint).map(s => {
      const sprintNumber = parseInt(s);
      return isNaN(sprintNumber) ? s : sprintNumber;
    });
  }

  // Get dates
  let dates = null;
  if (args.date) {
    dates = utility.arrayArg(args.date);
    if (dates.length) {
      for (let i = 0; i < dates.length; i++) {
        const dateValue = chrono.parseDate(dates[i]);
        if (dateValue === null) {
          utility.error('Unable to parse date', true);
        }
        dates[i] = dateValue;
      }
    }
  }

  // Get assigned
  let assigned = null;
  if (args.assigned) {
    assigned = utility.strArg(args.assigned);
  }

  // Get columns
  let columns = null;
  if (args.column) {
    columns = utility.arrayArg(args.column);
  }

  // Get normalisation mode
  let normalise = null;
  if (args.normalise) {
    normalise = args.normalise.toLowerCase();
    if (!['days', 'hours', 'minutes', 'seconds'].includes(normalise)) {
      normalise = 'auto';
    }
  }

  // Show burndown chart
  kanbn
  .burndown(sprints, dates, assigned, columns, normalise)
  .then(data => {
    if (args.json) {

      // Output raw data
      console.log(JSON.stringify(data, null, 2));
    } else {

      // Render chart
      const PADDING = '     ';
      const width = term.width - (PADDING.length + 1);

      const plots = [];
      for (s of data.series) {
        const plot = [], delta = Math.floor((s.to.getTime() - s.from.getTime()) / width);
        for (let i = 0; i < width; i++) {
          plot.push((s.dataPoints.find(d => d.x >= new Date(s.from.getTime() + i * delta)) || s.dataPoints[0]).y);
        }
        plots.push(plot);
      }
      const dateFormat = kanbn.getDateFormat(index);
      console.log(`${formatDate(s.from, dateFormat)} to ${formatDate(s.to, dateFormat)}:`);
      console.log(asciichart.plot(
        plots,
        {
          offset: 2,
          height: 10,
          padding: PADDING,
          format: x => (PADDING + x.toFixed(0)).slice(-PADDING.length),
          colors: [
            asciichart.default,
            asciichart.green,
            asciichart.blue,
            asciichart.red
          ]
        }
      ));
    }
  })
  .catch(error => {
    utility.error(error, true);
  });
};
