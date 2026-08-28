const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const capture = require('../capture');
const stripAnsi = require('strip-ansi');
const term = require('terminal-kit').terminal;
const {
	config: mockConfig,
	kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('burndown controller tests', {
	before() {
		require('../qunit-contains');
		mockRequire('../../src/main', mockKanbn);
		kanbn = require('../../index');
	},
	beforeEach() {
		mockConfig.reset();
		mockConfig.initialised = true;
		mockConfig.output = null;
		mockConfig.burndownData = {
			series: []
		};
	}
});

QUnit.test('Burndown in uninitialised folder should print an error', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stderr, s => {
		output.push(s);
	});

	mockConfig.initialised = false;
	await mockArgv(['burndown'], kanbn);

	captureConsole.stopIntercept(process.stderr);
	assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('Burndown with invalid date should print parse error', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stderr, s => {
		output.push(s);
	});

	await mockArgv(['burndown', '--date', 'not-a-date'], kanbn);

	captureConsole.stopIntercept(process.stderr);
	assert.contains(output, /Unable to parse date/);
});

QUnit.test('Burndown JSON output should include progress-based slope datapoints', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	mockConfig.burndownData = {
		series: [
			{
				from: new Date('2026-01-01T00:00:00.000Z'),
				to: new Date('2026-01-04T00:00:00.000Z'),
				dataPoints: [
					{
						x: new Date('2026-01-02T00:00:00.000Z'),
						y: 2,
						count: 1,
						tasks: [{ eventType: 'moved', task: { id: 'task-1' } }]
					},
					{
						x: new Date('2026-01-03T00:00:00.000Z'),
						y: 1,
						count: 1,
						tasks: [{ eventType: 'progress', task: { id: 'task-1' } }]
					}
				]
			}
		]
	};

	await mockArgv(['burndown', '--json'], kanbn);

	captureConsole.stopIntercept(process.stdout);
	const parsed = JSON.parse(output.join(''));
	assert.equal(parsed.series[0].dataPoints[0].y, 2);
	assert.equal(parsed.series[0].dataPoints[1].y, 1);
	assert.equal(parsed.series[0].dataPoints[1].tasks[0].eventType, 'progress');
});

QUnit.test('Burndown should pass parsed CLI arguments to kanbn.burndown', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	mockConfig.burndownData = { series: [] };

	await mockArgv([
		'burndown',
		'--json',
		'--sprint',
		'2',
		'--date',
		'2026-01-01',
		'--assigned',
		'Alex',
		'--column',
		'In Progress',
		'--normalise',
		'minutes'
	], kanbn);

	captureConsole.stopIntercept(process.stdout);

	assert.deepEqual(mockConfig.output.sprints, [2]);
	assert.equal(mockConfig.output.dates.length, 1);
	assert.equal(mockConfig.output.assigned, 'Alex');
	assert.deepEqual(mockConfig.output.columns, ['In Progress']);
	assert.equal(mockConfig.output.normalise, 'minutes');
});

QUnit.test('Burndown with "@me" should expand it to the current user', async assert => {
	mockConfig.currentUser = 'gordon';
	await capture.stdout(async () => {
		await mockArgv(['burndown', '--json', '--assigned', '@me'], kanbn);
	});

	assert.equal(mockConfig.output.assigned, 'gordon');
});

QUnit.test('Burndown with "@me" and no current user should print an error', async assert => {
	mockConfig.currentUser = null;
	const output = await capture.stderr(async () => {
		await mockArgv(['burndown', '--json', '--assigned', '@me'], kanbn);
	});

	assert.contains(output, /Unable to work out who you are/);
	assert.strictEqual(mockConfig.output, null);
});

// The chart is sized from the terminal width, which is undefined when stdout isn't a tty, so give
// the terminal a fixed width for the rendering tests
function withTerminalWidth(width, block) {
	const originalWidth = term.width;
	term.width = width;
	return (async () => {
		try {
			return await block();
		} finally {
			term.width = originalWidth;
		}
	})();
}

function testSeries() {
	return {
		series: [
			{
				from: new Date('2026-01-01T00:00:00.000Z'),
				to: new Date('2026-01-04T00:00:00.000Z'),
				dataPoints: [
					{ x: new Date('2026-01-01T00:00:00.000Z'), y: 3, count: 0, tasks: [] },
					{ x: new Date('2026-01-02T00:00:00.000Z'), y: 2, count: 1, tasks: [] },
					{ x: new Date('2026-01-03T00:00:00.000Z'), y: 1, count: 1, tasks: [] },
					{ x: new Date('2026-01-04T00:00:00.000Z'), y: 0, count: 1, tasks: [] }
				]
			}
		]
	};
}

QUnit.test('Burndown should render a chart with a date range heading', async assert => {
	mockConfig.burndownData = testSeries();

	const output = await withTerminalWidth(80, () => capture.stdout(async out => {
		await mockArgv(['burndown'], kanbn);
		await capture.waitFor(() => out.length > 1);
	}));

	assert.contains(output, /2026-01-01 to 2026-01-04:/);
});

QUnit.test('Burndown should render the y axis values of the series', async assert => {
	mockConfig.burndownData = testSeries();

	const output = await withTerminalWidth(80, () => capture.stdout(async out => {
		await mockArgv(['burndown'], kanbn);
		await capture.waitFor(() => out.length > 1);
	}));

	const chart = stripAnsi(output.join(''));
	assert.equal(/^\s+3\b/m.test(chart), true, 'the highest value is labelled');
	assert.equal(/^\s+0\b/m.test(chart), true, 'the lowest value is labelled');
});

QUnit.test('Burndown should render x axis labels under the chart', async assert => {
	mockConfig.burndownData = testSeries();

	const output = await withTerminalWidth(80, () => capture.stdout(async out => {
		await mockArgv(['burndown'], kanbn);
		await capture.waitFor(() => out.length > 1);
	}));

	const lines = stripAnsi(output.join('')).split('\n');
	const labelLine = lines[lines.length - 2];
	const tickLine = lines[lines.length - 3];

	assert.equal(labelLine.indexOf('2026-01-01') !== -1, true, 'the start date is labelled');
	assert.equal(labelLine.indexOf('2026-01-04') !== -1, true, 'the end date is labelled');
	assert.equal(tickLine.indexOf('|') !== -1, true, 'the labels have tick marks');
});

QUnit.test('A narrow terminal should drop labels rather than overlap them', async assert => {
	mockConfig.burndownData = testSeries();

	const output = await withTerminalWidth(20, () => capture.stdout(async out => {
		await mockArgv(['burndown'], kanbn);
		await capture.waitFor(() => out.length > 1);
	}));

	const lines = stripAnsi(output.join('')).split('\n');
	const labelLine = lines[lines.length - 2];

	// Only one label fits, and the labels never run into each other
	assert.equal((labelLine.match(/2026-01-\d\d/g) || []).length, 1);
});

QUnit.test('Burndown should render several series on one chart', async assert => {
	const data = testSeries();
	data.series.push({
		from: new Date('2026-01-01T00:00:00.000Z'),
		to: new Date('2026-01-04T00:00:00.000Z'),
		dataPoints: [
			{ x: new Date('2026-01-01T00:00:00.000Z'), y: 5, count: 0, tasks: [] },
			{ x: new Date('2026-01-04T00:00:00.000Z'), y: 4, count: 1, tasks: [] }
		]
	});
	mockConfig.burndownData = data;

	const output = await withTerminalWidth(80, () => capture.stdout(async out => {
		await mockArgv(['burndown'], kanbn);
		await capture.waitFor(() => out.length > 1);
	}));

	// The y axis is scaled to cover both series
	assert.equal(/^\s+5\b/m.test(stripAnsi(output.join(''))), true);
});
