const kanbn = require('../main');
const utility = require('../utility');
const chrono = require('chrono-node');
const formatDate = require('dateformat');

function formatHistoryEvent(event) {
	const details = [];
	if ('column' in event.event) {
		details.push(`column: ${event.event.column}`);
	}
	if ('fromColumn' in event.event || 'toColumn' in event.event) {
		details.push(`column: ${event.event.fromColumn || '?'} -> ${event.event.toColumn || '?'}`);
	}
	if ('fromProgress' in event.event || 'toProgress' in event.event) {
		details.push(`progress: ${event.event.fromProgress || 0} -> ${event.event.toProgress || 0}`);
	}
	if ('author' in event.event && event.event.author) {
		details.push(`author: ${event.event.author}`);
	}
	return details.join(', ');
}

function formatMetadataEvent(event, dateFormat) {
	if (!('field' in event.event) || !('value' in event.event) || !(event.event.value instanceof Date)) {
		return '';
	}
	return `${event.event.field}: ${formatDate(event.event.value, dateFormat)}`;
}

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

	// Get task ids
	let taskIds = null;
	if (args.task) {
		taskIds = utility.arrayArg(args.task).map((taskId) => utility.trimLeftEscapeCharacters(taskId));
	}

	kanbn
	.history(sprints, dates, assigned, taskIds)
	.then(data => {
		if (args.json) {
			console.log(JSON.stringify(data, null, 2));
			return;
		}

		if (data.events.length === 0) {
			console.log('No history events found');
			return;
		}

		const dateFormat = kanbn.getDateFormat(index);
		const lines = data.events.map((event) => {
			const eventDetails = event.source === 'history'
				? formatHistoryEvent(event)
				: formatMetadataEvent(event, dateFormat);
			const source = event.source === 'history' ? event.eventType : `metadata.${event.eventType}`;
			const line = `${formatDate(event.date, dateFormat)} | ${event.task.id} | ${source}`;
			return eventDetails
				? `${line} | ${eventDetails}`
				: line;
		});
		console.log(lines.join('\n'));
	})
	.catch(error => {
		utility.error(error);
	});
};
