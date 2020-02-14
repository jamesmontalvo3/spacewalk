/* Specify environment to include mocha globals */
/* eslint-env node, mocha */
/* eslint-disable require-jsdoc */

'use strict';

const assert = require('chai').assert;

const TasksHandler = require('./TasksHandler');
const Procedure = require('./Procedure');

describe('TasksHandler', function() {

	function makeDefinition() {
		return [
			{
				file: 'fake1.yml',
				roles: { crew: 'IV' }
			},
			{
				file: 'fake2.yml',
				roles: { crew: 'EV' }
			}
		];
	}

	function makeTasksHandler() {
		return new TasksHandler(
			makeDefinition(),
			new Procedure()
		);
	}

	function getWithDefinedTasks() {
		const tasksHandler = makeTasksHandler();
		const taskDef1 = {
			title: 'Fake 1',
			roles: [
				{
					name: 'crew',
					description: 'TBD',
					duration: { minutes: 5 }
				}
			],
			steps: []
		};
		const taskDef2 = {
			title: 'Fake 2',
			roles: [
				{
					name: 'crew',
					description: 'TBD',
					duration: { minutes: 10 }
				}
			],
			steps: []
		};
		tasksHandler.tasks[0].addTaskDefinition(taskDef1);
		tasksHandler.tasks[1].addTaskDefinition(taskDef2);
		return {
			tasksHandler: tasksHandler,
			expected: {
				'fake1.yml': taskDef1,
				'fake2.yml': taskDef2
			}
		};
	}

	describe('getDefinition()', function() {
		it('should return definitions equal to original', function() {
			const withDefTasks = getWithDefinedTasks();
			const reqs = makeDefinition();
			reqs[0].color = '#FFFFFF';
			reqs[1].color = '#FFFFFF';
			assert.deepStrictEqual(
				withDefTasks.tasksHandler.getDefinition(),
				{
					requirements: withDefTasks.tasksHandler.getRequirementsDefinitions(),
					tasks: withDefTasks.expected
				}
			);
		});
	});

	describe('getRequirementsDefinitions()', function() {
		it('should return requirements definitions equal to original', function() {
			const tasksHandler = makeTasksHandler();
			const definition = makeDefinition();
			definition[0].color = '#FFFFFF';
			definition[1].color = '#FFFFFF';
			assert.deepStrictEqual(tasksHandler.getRequirementsDefinitions(), definition);
		});
	});

	describe('getTaskDefinitions()', function() {
		it('should return task definitions equal to original', function() {
			const withDefTasks = getWithDefinedTasks();
			assert.deepStrictEqual(
				withDefTasks.tasksHandler.getTaskDefinitions(),
				withDefTasks.expected
			);
		});
	});

	describe('getTaskByFile()', function() {
		it('should map fake1.yml to index 0', function() {
			const tasksHandler = makeTasksHandler();
			assert.strictEqual(tasksHandler.tasks[0], tasksHandler.getTaskByFile('fake1.yml'));
		});
		it('should map fake2.yml to index 1', function() {
			const tasksHandler = makeTasksHandler();
			assert.strictEqual(tasksHandler.tasks[1], tasksHandler.getTaskByFile('fake2.yml'));
		});
	});

});
