'use strict';

const Task = require('../../app/model/Task');
const testProcedureGenerator = require('./testProcedureGenerator');

/**
 * @return {Task}
 */
function createTask() {
	const procedure = testProcedureGenerator('simple/procedures/proc.yml');
	const aTask = new Task(
		{
			file: 'some-task.yml',
			roles: { crewA: 'EV1', crewB: 'EV2' },
			color: '#7FB3D5'
		},
		procedure,
		{
			title: 'Some Task',
			roles: [
				{
					name: 'crewA',
					description: 'Person who does XYZ',
					duration: { minutes: 20 }
				},
				{
					name: 'crewB',
					description: 'Person who does ABC',
					duration: { minutes: 20 }
				}
			],
			steps: [
				{ simo: { IV: [], EV1: [], EV2: [] } }
			]
		}
	);
	return aTask;
}

module.exports = createTask;
