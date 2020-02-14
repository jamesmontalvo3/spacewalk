'use strict';

const Task = require('../../app/model/Task');
const testProcedureGenerator = require('../../test/generators/testProcedureGenerator');

/**
 *
 * @param {Object|string} stepDefinition  Either a string like "Do some stuff" or an object like:
 *                                        {
 *                                          step: "Do some stuff",
 *                                          title: "Time to do some stuff"
 *                                          duration: ..., checkboxes: ..., images: ...,
 *                                        }
 * @param {string}        roleName        Like "crewA" or "ssrmsCrew" or whatever to call the role.
 * @param {string}        actorName       Like "EV1" or "EV2". The actor passed into the role.
 * @return {Step}
 */
function stepModelGenerator(stepDefinition, roleName, actorName) {
	const procedure = testProcedureGenerator('simple/procedures/proc.yml');
	const rolesRequired = {};
	rolesRequired[roleName] = actorName;

	const division = {};
	division[roleName] = stepDefinition;

	const newTaskIndex = procedure.tasks.length;
	procedure.TasksHandler.insertTask(
		newTaskIndex,
		new Task(
			{ file: 'fooXYZ.yml', roles: rolesRequired },
			procedure,
			{
				title: 'Foo XYZ',
				roles: [{ name: roleName, duration: { minutes: 1 } }],
				steps: [division]
			}
		)
	);

	return procedure.tasks[newTaskIndex].concurrentSteps[0].subscenes[actorName].steps[0];
}

module.exports = stepModelGenerator;
