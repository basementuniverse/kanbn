const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
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
