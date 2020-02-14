'use strict';

const typeHelper = require('../helpers/typeHelper');
const Task = require('./Task');
const subscriptionHelper = require('../helpers/subscriptionHelper');

const tasksByFile = {};

module.exports = class TasksHandler {

	/**
	 *
	 * @param {Array} procTaskDefs   Receieves the "tasks" array from procedure definition
	 * @param {Procedure} procedure  Procedure model
	 */
	constructor(procTaskDefs, procedure) {

		// this has to be done here to avoid cirular references
		const Procedure = require('./Procedure');

		typeHelper.errorIfIsnt(procTaskDefs, 'array');
		typeHelper.errorIfIsnt(procedure, Procedure);

		this.tasks = [];
		this.taskUuidToObj = {};
		this.procedure = procedure;

		this.subscriberFns = {
			deleteTask: [],
			insertTask: [],
			moveTask: [],

			// these are actions really made against individual tasks, but subscription happens here
			timeUpdates: [], // FIXME should this be handled by setState() ?
			setState: [],

			// Still do this?
			updateTaskRequirements: [] // this data is stored in procedure file, but task model
		};

		procTaskDefs.forEach((procTaskDef, index) => {
			const task = new Task(procTaskDef, procedure);
			this.tasks[index] = task;
			this.taskUuidToObj[task.uuid] = task;
			tasksByFile[task.taskReqs.file] = task;
		});
	}

	getDefinition() {
		return {
			requirements: this.getRequirementsDefinitions(),
			tasks: this.getTaskDefinitions()
		};
	}

	getRequirementsDefinitions() {
		return this.tasks.map((task) => {
			return task.getRequirementsDefinition();
		});
	}

	getTaskDefinitions() {
		const def = {};
		for (const task of this.tasks) {
			def[task.taskReqs.file] = task.getTaskDefinition();
		}
		return def;
	}

	// FIXME this is copied* directly from ~~Step~~ Series. Create "ReloadableModel" and make them
	// extend it?
	// and that may be a better place than the subscriptionHelper.js file, except that maybe the
	// stateHandler logic needs it, too...?
	//
	// * copied, then refactored since Series has way more subscribable functions
	subscribe(subscriptionMethod, subscriberFn) {
		const unsubscribeFn = subscriptionHelper.subscribe(
			subscriberFn,
			this.subscriberFns[subscriptionMethod]
		);
		return unsubscribeFn;
	}

	getTaskByFile(taskFile) {
		if (!tasksByFile[taskFile]) {
			throw new Error(`Task with file name ${taskFile} not found!`);
		}
		return tasksByFile[taskFile];
	}

	// FIXME pick one place for these types of functions: procedure or TasksHandler
	getTaskIndexByUuid(uuid) {
		for (let i = 0; i < this.tasks.length; i++) {
			if (this.tasks[i].uuid === uuid) {
				return i;
			}
		}
		return -1;
	}

	getTaskIndexesByUuids(uuidArray) {
		const allUuidsArray = this.tasks.map((task) => task.uuid);
		const out = {};
		for (const wantedUuid of uuidArray) {
			out[wantedUuid] = allUuidsArray.indexOf(wantedUuid);
		}
		return out;
	}

	deleteTask(index) {
		console.log('TasksHandler.deleteTask');
		const [removedTask] = this.tasks.splice(index, 1);

		this.taskUuidToObj[removedTask.uuid] = null;
		tasksByFile[removedTask.taskReqs.file] = null;

		this.procedure.setupTimeSync(); // FIXME is there a cheaper way to do this?
		subscriptionHelper.run(this.subscriberFns.deleteTask, this);
	}

	insertTask(index, task = false) {
		console.log('TasksHandler.insertTask');
		if (!task) {
			task = this.makeTask();
		}
		this.tasks.splice(index, 0, task);

		// FIXME there's probably a cleaner way to handle doing this in multiple spots
		this.taskUuidToObj[task.uuid] = task;
		tasksByFile[task.taskReqs.file] = task;

		this.procedure.setupTimeSync(); // FIXME is there a cheaper way to do this?
		subscriptionHelper.run(this.subscriberFns.insertTask, this);
	}

	moveTask(oldIndex, newIndex) {
		console.log(`TasksHandler.moveTask(${oldIndex}, ${newIndex})`);

		const [taskToMove] = this.tasks.splice(oldIndex, 1);
		const realInsertIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;

		this.tasks.splice(realInsertIndex, 0, taskToMove);

		// FIXME is there a cheaper way to do this?
		this.clearNextAndPreviousTasks();
		this.procedure.setupTimeSync();

		subscriptionHelper.run(this.subscriberFns.moveTask, this);
	}

	/**
	 * @deprecated
	 * This creates a Task object with convenient defaults for generating new tasks in the UI. It
	 * is deprecated, since instead these defaults should be added to the Task constructor.
	 *
	 * @param {Object} taskRequirementsDef
	 * @param {Object} taskDef
	 * @return {Task}
	 */
	makeTask({ file, rolesCast, color } = {}, { title, rolesNeeded, steps } = {}) {
		// file = file || title || 'Temp_Name';
		title = title || 'Temp Name';

		const allTaskFiles = Object.keys(tasksByFile);

		const t = this.tasks[0]; // any random task. Hopefully there aren't zero. FIXME

		if (allTaskFiles.indexOf(file) !== -1) {
			throw new Error('Trying to do TasksHandler.makeTask() with a task file name already in use');
		} else if (!file) {
			let suffix = 2;
			let titlecheck = title + ' ' + suffix;
			let filecheck = t.formatTitleToFilename(titlecheck);
			while (allTaskFiles.indexOf(filecheck) !== -1) {
				suffix++;
				titlecheck = title + ' ' + suffix;
				filecheck = t.formatTitleToFilename(titlecheck);
				if (suffix > 1000) {
					throw new Error('WTF');
				}
			}
			title = titlecheck;
			file = filecheck;
		}

		rolesCast = rolesCast || { crewA: 'EV1', crewB: 'EV2' };
		color = color || '#FFDEAD';

		const task = new Task({ file, roles: rolesCast, color }, this.procedure);

		rolesNeeded = rolesNeeded || Object.keys(rolesCast).map((role) => {
			return { name: role, duration: { minutes: 30 } };
		});
		steps = steps || [];

		task.addTaskDefinition({ title, roles: rolesNeeded, steps });

		task.appendDivision(task.getEmptyDivisionDefinition(true, 'One small step'));
		return task;
	}

	notifyTaskSubscription(subscriptionName, task) {
		console.log(`TasksHandler running notifier for ${subscriptionName} on ${task.title}`);
		subscriptionHelper.run(this.subscriberFns[subscriptionName], task);
	}

	makeStepsDef(task) {
		const stepsDef = [{ simo: {} }];
		const canonRoles = task.getCanonicalRoles();
		for (const role of canonRoles) {
			stepsDef[0].simo[role] = [{ text: 'One small step' }];
		}
		return stepsDef;
	}

	getTaskUuids() {
		return this.tasks.map((task) => {
			return task.uuid;
		});
	}

	clearNextAndPreviousTasks() {
		for (const task of this.tasks) {
			for (const role in task.actorRolesDict) {
				task.actorRolesDict[role].nextTask = null;
				task.actorRolesDict[role].prevTask = null;
			}
		}
	}

	getNextUuids(uuid) {
		const taskIndex = this.getTaskIndexByUuid(uuid);
		const task = this.tasks[taskIndex];
		const nextTasks = {};
		for (const actor in task.actorRolesDict) {
			if (task.actorRolesDict[actor].nextTask) {
				nextTasks[task.actorRolesDict[actor].nextTask.uuid] = true;
			}
		}
		return Object.keys(nextTasks);
	}

};
