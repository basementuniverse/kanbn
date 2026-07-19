const kanbn = require('../main');
const utility = require('../utility');
const formatDate = require('dateformat');
const chrono = require('chrono-node');

const NOW_MARKER = '┆';
const ANSI_RESET = '\x1b[0m';
const ANSI_FG_LINE = '\x1b[97m';
const ANSI_FG_NOW = '\x1b[90m';
const ANSI_BG_NOT_STARTED = '\x1b[100m';
const ANSI_BG_STARTED = '\x1b[44m';
const ANSI_BG_COMPLETED = '\x1b[42m';

const DIR_UP = 1;
const DIR_DOWN = 2;
const DIR_LEFT = 4;
const DIR_RIGHT = 8;

const LINE_CHARS = {
  [DIR_UP]: '│',
  [DIR_DOWN]: '│',
  [DIR_LEFT]: '─',
  [DIR_RIGHT]: '─',
  [DIR_UP | DIR_DOWN]: '│',
  [DIR_LEFT | DIR_RIGHT]: '─',
  [DIR_DOWN | DIR_RIGHT]: '┌',
  [DIR_DOWN | DIR_LEFT]: '┐',
  [DIR_UP | DIR_RIGHT]: '└',
  [DIR_UP | DIR_LEFT]: '┘',
  [DIR_UP | DIR_DOWN | DIR_RIGHT]: '├',
  [DIR_UP | DIR_DOWN | DIR_LEFT]: '┤',
  [DIR_UP | DIR_LEFT | DIR_RIGHT]: '┴',
  [DIR_DOWN | DIR_LEFT | DIR_RIGHT]: '┬',
  [DIR_UP | DIR_DOWN | DIR_LEFT | DIR_RIGHT]: '┼'
};

function getBarGeometry(task, from, to, width) {
  if (width <= 1 || from.getTime() === to.getTime()) {
    return { start: 0, end: 0 };
  }

  // Calculate the position in the chart
  const totalSpan = to.getTime() - from.getTime();
  const taskStartPos = Math.max(0, Math.round((task.start.getTime() - from.getTime()) / totalSpan * (width - 1)));
  const taskEndPos = Math.min(width - 1, Math.round((task.end.getTime() - from.getTime()) / totalSpan * (width - 1)));

  return {
    start: taskStartPos,
    end: taskEndPos
  };
}

function getBarBackground(task) {
  if (task.completed instanceof Date) {
    return ANSI_BG_COMPLETED;
  }
  if (task.started instanceof Date) {
    return ANSI_BG_STARTED;
  }
  return ANSI_BG_NOT_STARTED;
}

function createChartCell() {
  return {
    bg: null,
    lineMask: 0,
    arrowChar: null
  };
}

function createChartGrid(height, width) {
  return Array.from({ length: height }, () => Array.from({ length: width }, createChartCell));
}

function addMask(cell, mask) {
  cell.lineMask |= mask;
}

function addHorizontalConnection(grid, row, fromCol, toCol) {
  if (fromCol === toCol) {
    return;
  }

  const step = fromCol < toCol ? 1 : -1;
  for (let col = fromCol; col !== toCol; col += step) {
    addMask(grid[row][col], step > 0 ? DIR_RIGHT : DIR_LEFT);
    addMask(grid[row][col + step], step > 0 ? DIR_LEFT : DIR_RIGHT);
  }
}

function addVerticalConnection(grid, col, fromRow, toRow) {
  if (fromRow === toRow) {
    return;
  }

  const step = fromRow < toRow ? 1 : -1;
  for (let row = fromRow; row !== toRow; row += step) {
    addMask(grid[row][col], step > 0 ? DIR_DOWN : DIR_UP);
    addMask(grid[row + step][col], step > 0 ? DIR_UP : DIR_DOWN);
  }
}

function routeDependency(grid, sourceRow, sourceCol, targetRow, targetCol) {
  if (sourceRow === null || targetRow === null) {
    return;
  }

  if (sourceRow === targetRow) {
    addHorizontalConnection(grid, sourceRow, sourceCol, targetCol);
    grid[targetRow][targetCol].arrowChar = targetCol >= sourceCol ? '→' : '←';
    return;
  }

  const moveRight = targetCol >= sourceCol;
  let routeCol = moveRight ? Math.max(sourceCol + 1, targetCol - 1) : Math.min(sourceCol - 1, targetCol + 1);
  routeCol = Math.max(0, Math.min(grid[0].length - 1, routeCol));

  addHorizontalConnection(grid, sourceRow, sourceCol, routeCol);
  addVerticalConnection(grid, routeCol, sourceRow, targetRow);
  addHorizontalConnection(grid, targetRow, routeCol, targetCol);
  grid[targetRow][targetCol].arrowChar = targetCol >= routeCol ? '→' : '←';
}

function buildDependencyOverlay(tasks, barGeometries, width) {
  const grid = createChartGrid(tasks.length, width);
  const taskRowMap = new Map(tasks.map((task, index) => [task.id, index]));

  tasks.forEach((task, targetRow) => {
    (task.dependencies || []).forEach((dependencyId) => {
      const sourceRow = taskRowMap.get(dependencyId);
      if (sourceRow === undefined) {
        return;
      }

      routeDependency(
        grid,
        sourceRow,
        barGeometries[sourceRow].end,
        targetRow,
        barGeometries[targetRow].start
      );
    });
  });

  return grid;
}

function styleCell(char, fg = null, bg = null) {
  if (!fg && !bg) {
    return char;
  }

  return `${fg || ''}${bg || ''}${char}${ANSI_RESET}`;
}

function renderChartRow(gridRow, barGeometry, barBackground, nowPosition) {
  return gridRow.map((cell, column) => {
    const bg = column >= barGeometry.start && column <= barGeometry.end ? barBackground : null;
    if (cell.arrowChar) {
      return styleCell(cell.arrowChar, ANSI_FG_LINE, bg);
    }

    const lineChar = LINE_CHARS[cell.lineMask] || null;
    if (lineChar) {
      return styleCell(lineChar, ANSI_FG_LINE, bg);
    }

    if (nowPosition === column) {
      return styleCell(NOW_MARKER, ANSI_FG_NOW, bg);
    }

    return styleCell(' ', null, bg);
  }).join('');
}

function renderTickRow(ticks, nowPosition) {
  return ticks.split('').map((char, column) => {
    if (char !== ' ') {
      return styleCell(char, ANSI_FG_LINE, null);
    }
    if (nowPosition === column) {
      return styleCell(NOW_MARKER, ANSI_FG_NOW, null);
    }
    return char;
  }).join('');
}

function getLabelPlacements(from, to, width, dateFormat, maxLabels) {
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
}

function renderXAxisLabels(from, to, width, dateFormat) {
  const sampleLabel = formatDate(from, dateFormat);
  const maxLabels = Math.max(1, Math.floor((width + 2) / (sampleLabel.length + 2)));
  const placements = getLabelPlacements(from, to, width, dateFormat, maxLabels);

  const ticks = Array(width).fill(' ');
  const labels = Array(width).fill(' ');

  for (const placement of placements) {
    ticks[placement.position] = '│';
    for (let i = 0; i < placement.label.length; i++) {
      labels[placement.start + i] = placement.label[i];
    }
  }

  return [ticks.join(''), labels.join('')];
}

function getNowPosition(from, to, width, now = new Date()) {
  if (now < from || now > to) {
    return null;
  }

  const totalSpan = to.getTime() - from.getTime();
  return Math.round((now.getTime() - from.getTime()) / totalSpan * (width - 1));
}

function renderNowOverlay(line, nowPosition) {
  if (nowPosition === null || nowPosition < 0 || nowPosition >= line.length) {
    return line;
  }

  const result = line.split('');
  result[nowPosition] = NOW_MARKER;
  return result.join('');
}

function truncateName(name, maxWidth) {
  if (name.length <= maxWidth) {
    return name;
  }
  return name.substring(0, maxWidth - 1) + '…';
}

module.exports = async args => {

  // Make sure kanbn has been initialised
  if (!await kanbn.initialised()) {
    utility.error('Kanbn has not been initialised in this folder\nTry running: {b}kanbn init{b}');
    return;
  }
  const index = await kanbn.getIndex();

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

  // Get mocked now date
  let now = null;
  if (args.now) {
    now = chrono.parseDate(utility.strArg(args.now));
    if (now === null) {
      utility.error('Unable to parse now date');
      return;
    }
  }

  // Show gantt chart data
  kanbn
  .gantt(assigned, columns, dates, now)
  .then(data => {
    if (args.json) {

      // Output raw data
      console.log(JSON.stringify(data, null, 2));
    } else {

      // Render chart
      const dateFormat = kanbn.getDateFormat(index);
      const maxNameWidth = 16;
      const nowDate = now || new Date();

      // Keep each rendered task line within terminal width where possible.
      // Line shape: "<prefix> <name> │<bar>│" => maxNameWidth + barWidth + 5 columns.
      const terminalWidth = Number.isFinite(process.stdout.columns) && process.stdout.columns > 0
        ? process.stdout.columns
        : 120;
      const barWidth = Math.max(1, terminalWidth - maxNameWidth - 5);
      const nowPosition = getNowPosition(data.from, data.to, barWidth, nowDate);
      const barGeometries = data.tasks.map((task) => getBarGeometry(task, data.from, data.to, barWidth));
      const dependencyOverlay = buildDependencyOverlay(data.tasks, barGeometries, barWidth);

      // Render header
      console.log(`Gantt chart: ${formatDate(data.from, dateFormat)} to ${formatDate(data.to, dateFormat)}`);
      if (data.dependencyCycleDetected) {
        const cycleDescription = Array.isArray(data.dependencyCycleTaskIds) && data.dependencyCycleTaskIds.length
          ? ` Cycle: ${data.dependencyCycleTaskIds.join(' -> ')}.`
          : '';
        console.error(`Warning: dependency cycle detected; using fallback ordering for ${data.cycleFallbackTaskIds.length} task(s).${cycleDescription}`);
      }
      console.log('');

      // Render tasks with bars
      data.tasks.forEach((task, taskIndex) => {
        const prefix = task.blocked ? '⧗' : ' ';
        const truncatedName = truncateName(task.name, maxNameWidth);
        const bar = renderChartRow(
          dependencyOverlay[taskIndex],
          barGeometries[taskIndex],
          getBarBackground(task),
          nowPosition
        );

        console.log(`${prefix} ${truncatedName.padEnd(maxNameWidth)} │${bar}│`);
      });

      // Render x-axis
      console.log('');
      const [ticks, labels] = renderXAxisLabels(data.from, data.to, barWidth, dateFormat);
      console.log(`  ${''.padEnd(maxNameWidth)} │${renderTickRow(ticks, nowPosition)}│`);
      console.log(`  ${''.padEnd(maxNameWidth)} │${labels}│`);
    }
  })
  .catch(error => {
    utility.error(error);
  });
};
