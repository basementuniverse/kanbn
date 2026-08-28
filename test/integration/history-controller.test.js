const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const capture = require('../capture');
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
		mockConfig.reset();
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

QUnit.test('History with no events should say so', async assert => {
	const output = await capture.stdout(async out => {
		await mockArgv(['history'], kanbn);
		await capture.waitFor(() => out.length > 0);
	});

	assert.contains(output, /No history events found/);
});

QUnit.test('History should print one line per event', async assert => {
	mockConfig.historyData = {
		periods: [],
		events: [
			{
				date: new Date('2026-01-01T00:00:00.000Z'),
				source: 'history',
				eventType: 'created',
				task: { id: 'task-1', name: 'Task 1', assigned: null, column: 'Backlog' },
				event: { column: 'Backlog' }
			},
			{
				date: new Date('2026-01-02T00:00:00.000Z'),
				source: 'history',
				eventType: 'moved',
				task: { id: 'task-1', name: 'Task 1', assigned: null, column: 'In Progress' },
				event: { fromColumn: 'Backlog', toColumn: 'In Progress' }
			}
		]
	};

	const output = await capture.stdout(async out => {
		await mockArgv(['history'], kanbn);
		await capture.waitFor(() => out.length > 0);
	});

	assert.contains(output, /2026-01-01 \| task-1 \| created \| column: Backlog/);
	assert.contains(output, /2026-01-02 \| task-1 \| moved \| column: Backlog -> In Progress/);
});

QUnit.test('History should include progress and author details', async assert => {
	mockConfig.historyData = {
		periods: [],
		events: [
			{
				date: new Date('2026-01-03T00:00:00.000Z'),
				source: 'history',
				eventType: 'progress',
				task: { id: 'task-1', name: 'Task 1', assigned: null, column: 'In Progress' },
				event: { fromProgress: 0.25, toProgress: 0.75, author: 'Alex' }
			}
		]
	};

	const output = await capture.stdout(async out => {
		await mockArgv(['history'], kanbn);
		await capture.waitFor(() => out.length > 0);
	});

	assert.contains(output, /progress: 0\.25 -> 0\.75/);
	assert.contains(output, /author: Alex/);
});

QUnit.test('History should format metadata events using the index date format', async assert => {
	mockConfig.historyData = {
		periods: [],
		events: [
			{
				date: new Date('2026-01-04T00:00:00.000Z'),
				source: 'metadata',
				eventType: 'due',
				task: { id: 'task-1', name: 'Task 1', assigned: null, column: 'Backlog' },
				event: { field: 'due', value: new Date('2026-02-01T00:00:00.000Z') }
			}
		]
	};

	const output = await capture.stdout(async out => {
		await mockArgv(['history'], kanbn);
		await capture.waitFor(() => out.length > 0);
	});

	assert.contains(output, /2026-01-04 \| task-1 \| metadata\.due \| due: 2026-02-01/);
});

QUnit.test('A metadata event with no date value should print without details', async assert => {
	mockConfig.historyData = {
		periods: [],
		events: [
			{
				date: new Date('2026-01-05T00:00:00.000Z'),
				source: 'metadata',
				eventType: 'assigned',
				task: { id: 'task-1', name: 'Task 1', assigned: 'Alex', column: 'Backlog' },
				event: { field: 'assigned', value: 'Alex' }
			}
		]
	};

	const output = await capture.stdout(async out => {
		await mockArgv(['history'], kanbn);
		await capture.waitFor(() => out.length > 0);
	});

	assert.contains(output, /2026-01-05 \| task-1 \| metadata\.assigned\n/);
});

QUnit.test('History with "@me" should expand it to the current user', async assert => {
	mockConfig.currentUser = 'gordon';
	await capture.stdout(async () => {
		await mockArgv(['history', '--json', '--assigned', '@me'], kanbn);
	});

	assert.equal(mockConfig.output.assigned, 'gordon');
});

QUnit.test('History with "@me" and no current user should print an error', async assert => {
	mockConfig.currentUser = null;
	const output = await capture.stderr(async () => {
		await mockArgv(['history', '--json', '--assigned', '@me'], kanbn);
	});

	assert.contains(output, /Unable to work out who you are/);
	assert.strictEqual(mockConfig.output, null);
});
