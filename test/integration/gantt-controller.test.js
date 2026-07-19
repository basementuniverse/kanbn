const mockRequire = require('mock-require');
const mockArgv = require('mock-argv');
const captureConsole = require('capture-console');
const {
	config: mockConfig,
	kanbn: mockKanbn
} = require('../mock-kanbn');

let kanbn;

QUnit.module('gantt controller tests', {
	before() {
		require('../qunit-contains');
		mockRequire('../../src/main', mockKanbn);
		kanbn = require('../../index');
	},
	beforeEach() {
		mockConfig.initialised = true;
		mockConfig.output = null;
		mockConfig.ganttData = {
			from: new Date('2026-01-01T00:00:00.000Z'),
			to: new Date('2026-01-03T00:00:00.000Z'),
			tasks: [
				{
					id: 'task-1',
					name: 'Task 1',
					start: new Date('2026-01-01T00:00:00.000Z'),
					end: new Date('2026-01-02T00:00:00.000Z'),
					dependencies: []
				}
			]
		};
	}
});

QUnit.test('Gantt JSON output should include scheduled tasks', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	await mockArgv(['gantt', '--json'], kanbn);

	captureConsole.stopIntercept(process.stdout);
	const parsed = JSON.parse(output.join(''));
	assert.equal(parsed.tasks[0].name, 'Task 1');
	assert.equal(parsed.tasks[0].start, '2026-01-01T00:00:00.000Z');
	assert.equal(mockConfig.output.gantt, true);
});

QUnit.test('Gantt with invalid now date should print parse error', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stderr, s => {
		output.push(s);
	});

	await mockArgv(['gantt', '--now', 'not-a-date'], kanbn);

	captureConsole.stopIntercept(process.stderr);
	assert.contains(output, /Unable to parse now date/);
});

QUnit.test('Gantt should pass parsed now date to kanbn.gantt', async assert => {
	await mockArgv(['gantt', '--now', '2026-01-02'], kanbn);

	assert.ok(mockConfig.output.now instanceof Date);
	assert.ok(mockConfig.output.now.toISOString().startsWith('2026-01-02'));
});

QUnit.test('Gantt should warn when dependency cycles are detected', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stderr, s => {
		output.push(s);
	});

	mockConfig.ganttData = {
		from: new Date('2026-01-01T00:00:00.000Z'),
		to: new Date('2026-01-03T00:00:00.000Z'),
		dependencyCycleDetected: true,
		dependencyCycleTaskIds: ['task-1', 'task-2', 'task-1'],
		cycleFallbackTaskIds: ['task-1', 'task-2'],
		tasks: [
			{
				id: 'task-1',
				name: 'Task 1',
				start: new Date('2026-01-01T00:00:00.000Z'),
				end: new Date('2026-01-02T00:00:00.000Z'),
				dependencies: []
			}
		]
	};

	await mockArgv(['gantt'], kanbn);

	captureConsole.stopIntercept(process.stderr);
	assert.contains(output, /Warning: dependency cycle detected/);
	assert.contains(output, /task-1 -> task-2 -> task-1/);
});

QUnit.test('Gantt should render now marker inline without separate label line', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	await mockArgv(['gantt', '--now', '2026-01-02'], kanbn);

	captureConsole.stopIntercept(process.stdout);
	const rendered = output.join('');
	assert.notOk(/← now/.test(rendered));
	assert.ok(rendered.includes('┆'));
});

QUnit.test('Gantt should render dependency arrows inline without dependency label rows', async assert => {
	const output = [];
	captureConsole.startIntercept(process.stdout, s => {
		output.push(s);
	});

	mockConfig.ganttData = {
		from: new Date('2026-01-01T00:00:00.000Z'),
		to: new Date('2026-01-03T00:00:00.000Z'),
		tasks: [
			{
				id: 'task-1',
				name: 'Task 1',
				start: new Date('2026-01-01T00:00:00.000Z'),
				end: new Date('2026-01-02T00:00:00.000Z'),
				dependencies: []
			},
			{
				id: 'task-2',
				name: 'Task 2',
				start: new Date('2026-01-02T00:00:00.000Z'),
				end: new Date('2026-01-03T00:00:00.000Z'),
				dependencies: ['task-1']
			}
		]
	};

	await mockArgv(['gantt'], kanbn);

	captureConsole.stopIntercept(process.stdout);
	const rendered = output.join('');
	assert.ok(/[→←┌┐└┘├┤┬┴┼─│]/.test(rendered));
	assert.notOk(/└─→ task-1/.test(rendered));
	assert.notOk(/\n\s+└─→ /.test(rendered));
});
