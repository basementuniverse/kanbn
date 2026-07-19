const kanbn = require('../main');
const utility = require('../utility');
const asciichart = require('asciichart');
const term = require('terminal-kit').terminal;
const chrono = require('chrono-node');
const formatDate = require('dateformat');

const getLabelPlacements = (from, to, width, dateFormat, maxLabels) => {
  for (let count = maxLabels; count >= 1; count--) {
    const placements = [];
    let previousEnd = -1;

    for (let i = 0; i < count; i++) {
      const ratio = count === 1 ? 0 : i / (count - 1);
      const position = Math.round(ratio * (width - 1));
      const value = new Date(from.getTime() + Math.round((to.getTime() - from.getTime()) * ratio));
      const label = formatDate(value, dateFormat);

      let start = position - Math.floor(label.length / 2);
      if (start < 0) {
        start = 0;
      }
      if (start + label.length > width) {
        start = Math.max(0, width - label.length);
      }

      const end = start + label.length - 1;
      if (i > 0 && start <= previousEnd + 1) {
        placements.length = 0;
        break;
      }

      placements.push({ position, start, label, end });
      previousEnd = end;
    }

    if (placements.length) {
      return placements;
    }
  }

  return [];
};

const renderXAxisLabels = (from, to, width, dateFormat, leftPadding) => {
  const sampleLabel = formatDate(from, dateFormat);
  const maxLabels = Math.max(1, Math.floor((width + 2) / (sampleLabel.length + 2)));
  const placements = getLabelPlacements(from, to, width, dateFormat, maxLabels);

  const ticks = Array(width).fill(' ');
  const labels = Array(width).fill(' ');

  for (const placement of placements) {
    ticks[placement.position] = '|';
    for (let i = 0; i < placement.label.length; i++) {
      labels[placement.start + i] = placement.label[i];
    }
  }

  return `${leftPadding}${ticks.join('')}\n${leftPadding}${labels.join('')}`;
};

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
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
          utility.error('Unable to parse date');
          return;
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
      const width = Math.max(1, term.width - (PADDING.length + 1));

      const plots = [];
      for (const s of data.series) {
        const plot = [];
        const span = Math.max(1, s.to.getTime() - s.from.getTime());
        const delta = width > 1 ? span / (width - 1) : 0;
        for (let i = 0; i < width; i++) {
          const x = new Date(s.from.getTime() + Math.round(i * delta));
          plot.push((s.dataPoints.find(d => d.x >= x) || s.dataPoints[0]).y);
        }
        plots.push(plot);
      }

      const referenceSeries = data.series[0];
      const dateFormat = kanbn.getDateFormat(index);
      console.log(`${formatDate(referenceSeries.from, dateFormat)} to ${formatDate(referenceSeries.to, dateFormat)}:`);
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
      console.log(renderXAxisLabels(
        referenceSeries.from,
        referenceSeries.to,
        width,
        dateFormat,
        ' '.repeat(PADDING.length + 1)
      ));
    }
  })
  .catch(error => {
    utility.error(error);
  });
};
