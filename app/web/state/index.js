'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const jsdiff = require('diff');

const subscriptionHelper = require('../../helpers/subscriptionHelper');

const state = {};
const subscriberFns = {};

// FIXME should this be in state too?
const changesDiffs = [];

/**
 *
 * @param {*} stateProp           - Property to subscribe to changes to, e.g. this.state.someprop
 * @param {Function} subscriberFn - Function to run when value of prop changed
 * @return {Function}             - Unsubscribe function
 */
function subscribe(stateProp, subscriberFn) {
	if (!subscriberFns[stateProp]) {
		subscriberFns[stateProp] = [];
	}
	const unsubscribeFn = subscriptionHelper.subscribe(
		subscriberFn,
		subscriberFns[stateProp]
	);
	return unsubscribeFn;
}

/**
 *
 * @param {*} changes
 */
function setState(changes) {
	for (const prop in changes) {
		const change = changes[prop];
		state[prop] = change;
		if (subscriberFns[prop] && subscriberFns[prop].length > 0) {
			subscriptionHelper.run(subscriberFns[prop], change);
		}
	}
}

/**
 * Compare procedure against previous version of procedure. Record state for comparison with future
 * changes and console.log() a diff from the previous change.
 *
 * FIXME: does this belong in stateHandler?
 */
function recordAndReportChange() {
	const newYaml = YAML.dump(state.procedure.getDefinition());

	const diff = jsdiff.diffLines(
		state.lastProcDefinitionYaml,
		newYaml
	);

	const css = [];

	const diffText = diff
		.map((change) => {
			if (change.added) {
				css.push('color: green');
				return `%c+ ${change.value.trimEnd()}`;
			} else if (change.removed) {
				css.push('color: red');
				return `%c- ${change.value.trimEnd()}`;
			} else {
				css.push('color: gray');
				return `%c  (${change.count} unchanged line${change.count === 1 ? '' : 's'})`;
			}
		})
		.join('\n');

	changesDiffs.push(diffText);

	console.log(diffText, ...css);
	setState({ lastProcDefinitionYaml: newYaml });

}

/**
 * @param {Task|Procedure} taskOrProcedure
 * @return {Object}
 */
function getPathParts(taskOrProcedure) {

	// FIXME: Maestro issue #121, no using 'instanceof'
	if (taskOrProcedure.constructor.name === 'Procedure') {
		return {
			basepath: state.program.proceduresPath,
			filename: state.procedure.procedureFile
		};
	} else if (taskOrProcedure.constructor.name === 'Task') {
		return {
			basepath: state.program.tasksPath,
			filename: taskOrProcedure.taskReqs.file // electron this is full path, web just filename
		};
	}

	throw new Error('taskOrProcedure must be Task or Procedure');
}

/**
 * @param {string} path
 */
function exists(path) {
	fetch(
		path,
		{
			method: 'POST' // or 'PUT'
		}
	)
		.then((response) => response.json())
		.then((data) => {
			console.log('Success:', data);
		})
		.catch((error) => {
			console.error('Error:', error);
		});
}

/**
 * @param {Task|Procedure} taskOrProcedure
 * @param {string} newFilename
 * @param {Function} completeFn
 */
function moveFileElectron(taskOrProcedure, newFilename, completeFn) {
	const p = getPathParts(taskOrProcedure);
	const src = path.join(p.basepath, p.filename);
	const dest = path.join(p.basepath, newFilename);
	console.log(`moving file from ${src} to ${dest}`);
	state.program.moveFile(
		src,
		dest,
		completeFn,
		completeFn
	);
}
/**
 * @param {Task|Procedure} taskOrProcedure
 * @param {string} newFilename
 * @param {Function} completeFn
 */
function moveFileWeb(taskOrProcedure, newFilename, completeFn) {
	const p = getPathParts(taskOrProcedure);
	fetch(
		`move/${p.basepath}/${p.filename}/${newFilename}`,
		{
			method: 'POST' // or 'PUT'
		}
	)
		.then((response) => response.json())
		.then((data) => {
			console.log('Success:', data);
			completeFn(data);
		})
		.catch((error) => {
			console.error('Error:', error);
			completeFn(error);
		});
}

/**
 * @param {Task|Procedure} taskOrProcedure
 * @param {string} newFilename
 * @param {Function} completeFn
 */
function moveFile(taskOrProcedure, newFilename, completeFn = function() {}) {
	if (window.isElectron) {
		moveFileElectron(taskOrProcedure, newFilename, completeFn);
	} else {
		moveFileWeb(taskOrProcedure, newFilename, completeFn);
	}
}

/**
 * Save yamlString to Activity file
 *
 * @param {Task|Procedure} taskOrProcedure  Task or Procedure object
 * @param {string} yamlString
 */
function saveChangeElectron(taskOrProcedure, yamlString) {
	const p = getPathParts(taskOrProcedure);
	fs.writeFile(
		path.join(p.basepath, p.filename),
		yamlString,
		{},
		(err) => {
			if (err) {
				throw err;
			}
		}
	);
}

/**
 * Save yamlString to Activity file
 *
 * @param {Task|Procedure} taskOrProcedure
 * @param {string} yamlString
 */
function saveChangeWeb(taskOrProcedure, yamlString) {
	const p = getPathParts(taskOrProcedure);
	fetch(
		`edit/${p.basepath}/${p.filename}`,
		{
			method: 'POST', // or 'PUT'
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				yaml: yamlString
			})
		}
	)
		.then((response) => response.json())
		.then((data) => {
			console.log('Success:', data);
		})
		.catch((error) => {
			console.error('Error:', error);
		});
}

/**
 * Save changes for a particular Activity
 *
 * @param {number} activityIndex                Index Activity to save to file
 */
function saveChange(activityIndex) {
	const activity = state.procedure.tasks[activityIndex];
	const yamlString = YAML.dump(activity.getTaskDefinition());

	if (window.isElectron) {
		saveChangeElectron(activity, yamlString);
	} else {
		saveChangeWeb(activity, yamlString);
	}

	recordAndReportChange();
}

/**
 *
 */
function saveProcedureChange() {
	const yamlString = YAML.dump(state.procedure.getOnlyProcedureDefinition());

	if (window.isElectron) {
		saveChangeElectron(state.procedure, yamlString);
	} else {
		saveChangeWeb(state.procedure, yamlString);
	}

	recordAndReportChange();
}

module.exports = {
	state: state,
	setState: setState,
	subscribe: subscribe,
	saveChange: saveChange,
	saveProcedureChange: saveProcedureChange,
	recordAndReportChange: recordAndReportChange,
	exists: exists,
	moveFile: moveFile
};
