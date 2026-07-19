const kanbn = require('../main');
const utility = require('../utility');
const formatDate = require('dateformat');

const DAY = 24 * 60 * 60 * 1000;

function renderBar(task, from, to) {
  const result = [];
  for (let date = new Date(from.getTime()); date <= to; date = new Date(date.getTime() + DAY)) {
    if (date < task.start || date > task.end) {
      result.push(' ');
    } else if (task.completed instanceof Date) {
      result.push('█');
    } else if (task.started instanceof Date) {
      result.push('▓');
    } else {
      result.push('░');
    }
  }
  return result.join('');
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }
  const index = await kanbn.getIndex();

  // Show gantt chart data
  kanbn
  .gantt()
  .then(data => {
    if (args.json) {

      // Output raw data
      console.log(JSON.stringify(data, null, 2));
    } else {

      // Render chart
      const dateFormat = kanbn.getDateFormat(index);
      const labelWidth = Math.max(...data.tasks.map(task => task.name.length), 4);

      console.log(`Gantt chart: ${formatDate(data.from, dateFormat)} to ${formatDate(data.to, dateFormat)}`);
      data.tasks.forEach(task => {
        const prefix = task.blocked ? '⧗ ' : '  ';
        const range = `[${formatDate(task.start, dateFormat)} → ${formatDate(task.end, dateFormat)}]`;
        console.log(`${prefix}${task.name.padEnd(labelWidth)} ${range} ${renderBar(task, data.from, data.to)}`);
        if (task.dependencies.length) {
          console.log(`${' '.repeat(prefix.length + labelWidth + 1)}↳ depends-on: ${task.dependencies.join(', ')}`);
        }
      });
    }
  })
  .catch(error => {
    utility.error(error);
  });
};
