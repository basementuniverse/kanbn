const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const {
	config: mockConfig,
	kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('history controller tests', {
	before() {
		require('../qunit-contains');
		mockRequire('../../src/main', mockKanbn);
		kanbn = require('../../index');
	},
	beforeEach() {
		mockConfig.initialised = true;
		mockConfig.output = null;
		mockConfig.historyData = {
			periods: [],
			events: []
		};
	}
});

QUnit.test('History in uninitialised folder should print an error', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stderr, s => {
		output.push(s);
	});

	mockConfig.initialised = false;
	await mockArgv(['history'], kanbn);

	captureConsole.stopIntercept(process.stderr);
	assert.contains(output, /Kanbn has not been initialised in this folder/);
});

QUnit.test('History with invalid date should print parse error', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stderr, s => {
		output.push(s);
	});

	await mockArgv(['history', '--date', 'not-a-date'], kanbn);

	captureConsole.stopIntercept(process.stderr);
	assert.contains(output, /Unable to parse date/);
});

QUnit.test('History JSON output should include events', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	mockConfig.historyData = {
		periods: [],
		events: [
			{
				date: new Date('2026-01-02T00:00:00.000Z'),
				source: 'history',
				eventType: 'moved',
				task: { id: 'task-1', name: 'Task 1', assigned: null, column: 'In Progress' },
				event: { fromColumn: 'Backlog', toColumn: 'In Progress' }
			}
		]
	};

	await mockArgv(['history', '--json'], kanbn);

	captureConsole.stopIntercept(process.stdout);
	const parsed = JSON.parse(output.join(''));
	assert.equal(parsed.events.length, 1);
	assert.equal(parsed.events[0].eventType, 'moved');
	assert.equal(mockConfig.output.history, true);
});

QUnit.test('History should pass parsed CLI arguments to kanbn.history', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	await mockArgv([
		'history',
		'--json',
		'--sprint',
		'2',
		'--date',
		'2026-01-01',
		'--assigned',
		'Alex',
		'--task',
		'task-1'
	], kanbn);

	captureConsole.stopIntercept(process.stdout);

	assert.deepEqual(mockConfig.output.sprints, [2]);
	assert.equal(mockConfig.output.dates.length, 1);
	assert.equal(mockConfig.output.assigned, 'Alex');
	assert.deepEqual(mockConfig.output.taskIds, ['task-1']);
});
