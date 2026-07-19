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
