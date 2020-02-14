'use strict';

const uuidv4 = require('uuid/v4');
// const filenamify = require('filenamify');

const Duration = require('./Duration');
const ConcurrentStep = require('./ConcurrentStep');
const TaskRole = require('./TaskRole');
const TaskRequirements = require('./TaskRequirements');
const consoleHelper = require('../helpers/consoleHelper');
const arrayHelper = require('../helpers/arrayHelper');
const typeHelper = require('../helpers/typeHelper');
const yamlFileNamify = require('../helpers/yamlFileNamify');
const subscriptionHelper = require('../helpers/subscriptionHelper');

const validTimeTypes = ['startTime', 'endTime', 'duration'];

/**
 * Set .updateStartTimesRequired on procedures TimeSync object, noting that times need re-syncing
 * @param {Task} task
 */
function timeSyncRequired(task) {
	task.procedure.timeSync.updateStartTimesRequired = true;
}

/**
 * From inputs of two types, get the third type
 * @param {string} first   Either startTime, endTime, or duration
 * @param {string} second  Either startTime, endTime, or duration (but not the same as first)
 * @return {string}        The third type, whichever first and second is not.
 */
function getThirdTimeType(first, second) {
	if (!arrayHelper.isAnyOf(first, validTimeTypes) ||
		!arrayHelper.isAnyOf(second, validTimeTypes)) {

		throw new Error(`Two time types required, and must be in ${JSON.stringify(validTimeTypes)}`);
	} else if (first === second) {
		throw new Error('First and second paramaters should not be the same');
	}

	const inputs = {
		duration: first === 'duration' || second === 'duration',
		startTime: first === 'startTime' || second === 'startTime',
		endTime: first === 'endTime' || second === 'endTime'
	};
	for (const type in inputs) {
		if (inputs[type] === false) {
			// this input not present, return it
			return type;
		}
	}
}

/**
 * Based upon another time (that has probably been recently changed...at least that's the point of
 * this function) update another time if the third time type is defined. For example, if the
 * startTime was just changed, and the duration is defined, update the endTime by start + duration.
 *
 * Note on implementation: Getting the endTime requires addition of start and duration. Getting the
 * duration or startTime requires subtraction of one from the endTime. So which action to take, sum
 * or subtract, must be determined.
 *
 * @param {TaskRole} taskRole
 * @param {string} recentlyChanged
 * @param {string} tryToChange
 */
function updateDependentTime(taskRole, recentlyChanged, tryToChange) {
	const third = getThirdTimeType(recentlyChanged, tryToChange);
	let change;

	if (tryToChange === 'startTime' && taskRole[third]) {
		change = {
			action: 'subtract',
			firstOperand: 'endTime',
			secondOperand: 'duration',
			ifPropPresent: third
		};

	} else if (tryToChange === 'endTime' && taskRole[third]) {
		change = {
			action: 'sum',
			firstOperand: 'startTime',
			secondOperand: 'duration',
			ifPropPresent: third
		};
	} else if (taskRole[third]) { // tryToChange === duration
		change = {
			action: 'subtract',
			firstOperand: 'endTime',
			secondOperand: 'startTime',
			ifPropPresent: third
		};
	} else {
		return;
	}

	taskRole[tryToChange] = Duration[change.action](
		taskRole[change.firstOperand],
		taskRole[change.secondOperand]
	);
}

/**
 * Helper function to perform time update exposed in exported functions
 * @param {Task} task                 Task on which to set time
 * @param {string} actor              Actor to set time for
 * @param {string} timeType           Either 'startTime, 'duration', or 'endTime'
 * @param {Duration} time             Duration object specifying time to be set
 * @param {string} dependentTimeType  Either 'startTime, 'duration', or 'endTime'. Not === timeType
 */
function doTimeUpdate(task, actor, timeType, time, dependentTimeType) {
	task.actorRolesDict[actor][timeType] = time.clone();
	timeSyncRequired(task); // this time was updated and may affect other times in procedure
	updateDependentTime(task.actorRolesDict[actor], timeType, dependentTimeType);
}

module.exports = class Task {

	/**
	 * Constructor for Task object
	 * @param  {Object} taskRequirementsDef     Info about this usage of task from procedure file
	 * @param  {Object} procedure               Procedure instance
	 * @param {Object|null} taskDef             The contents of the task file
	 */
	constructor(taskRequirementsDef, procedure, taskDef = null) {
		this.subscriberFns = {
			deleteDivision: [],
			insertDivision: [],
			appendDivision: []
		};

		this.title = 'Temp Name';
		this.uuid = uuidv4(); // used by Procedure/TasksHandler to find this Task

		this.divisionUuidToObj = {}; // used by Task to find Divisions

		this.procedure = procedure;
		this.concurrentSteps = [];

		this.updateTaskRequirements(taskRequirementsDef);

		if (taskDef) {
			this.setState(taskDef);
		}
	}

	getDefinition() {
		return {
			requirements: this.getRequirementsDefinition(),
			task: this.getTaskDefinition()
		};
	}

	getRequirementsDefinition() {
		return this.taskReqs.getDefinition();
	}

	getTaskDefinition() {
		const rolesDefs = [];
		for (const role of this.rolesArr) {
			rolesDefs.push(role.getDefinition());
		}

		const concurrentStepsDefs = [];
		for (const cs of this.concurrentSteps) {
			const csDef = cs.getDefinition();
			if (csDef) {
				concurrentStepsDefs.push(csDef);
			}
		}

		return {
			title: this.title,
			roles: rolesDefs,
			steps: concurrentStepsDefs
		};
		// throw new Error('NOT YET DEFINED');
	}

	setState(newState) {
		let taskFileChanges = 0;
		// let procedureFileChanges = 0;
		if (newState.title) {
			taskFileChanges += this.setTitle(newState.title) ? 1 : 0;
		}
		if (newState.roles) {
			taskFileChanges += this.setRoles(newState.roles) ? 1 : 0;
		}
		if (newState.steps) {
			taskFileChanges += this.setDivisions(newState.steps) ? 1 : 0;
		}
		if (newState.file) {
			const change = this.taskReqs.setFile(newState.file);
			taskFileChanges += change;
			// procedureFileChanges += change;
		}

		// if changes were made, notify
		if (this.procedure.TasksHandler && taskFileChanges > 0) {
			this.procedure.TasksHandler.notifyTaskSubscription('setState', this);
		}

		// FIXME handle procedureFileChanges

	}

	setTitle(title) {
		if (this.title === title) {
			// console.log(`skipping Task.setTitle(); Identical titles: ${title}`);
			return false;
		}
		// console.log(`Running Task.setTitle(); Was ${this.title}. Is ${title}`);
		this.title = title;

		return true;
	}

	setDivisions(divisionsDef) {
		// remove previous divisions
		this.divisionUuidToObj = {};
		this.concurrentSteps = [];

		// Get the steps. ConcurrentSteps class will handle the simo vs actor stuff in the yaml.
		for (const divisionDef of divisionsDef) {
			const division = new ConcurrentStep(divisionDef, this);
			this.divisionUuidToObj[division.uuid] = division;
			this.concurrentSteps.push(division);
		}

		// FIXME this should return false if no changes were made
		return true;
	}

	formatTitleToFilename(titleToFormat) {
		return yamlFileNamify(titleToFormat);
		// this.TaskReqs.setFile(filename);
	}

	updateTaskRequirements(taskRequirementsDef) {
		// Why "requirements"? See TaskRequirements
		if (!this.taskReqs) {
			this.taskReqs = new TaskRequirements(taskRequirementsDef, this);
		} else {
			this.taskReqs.updateDefinition(taskRequirementsDef);
		}

		// when procedure is initially loading, reference to TasksHandler not available yet. Should
		// not need to subscribe to changes at that point (knock on wood).
		if (this.procedure.TasksHandler) {
			// allows UI to subscribe to all task events through TasksHandler
			this.procedure.TasksHandler.notifyTaskSubscription('updateTaskRequirements', this);
		}
	}

	// FIXME this is copied* directly from Step. Create "ReloadableModel" and make them extend it?
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

	deleteDivision(divisionIndex) {
		console.log(`Activity.deleteDivision, index = ${divisionIndex}`);
		const removedDivision = this.concurrentSteps.splice(divisionIndex, 1);
		this.divisionUuidToObj[removedDivision.uuid] = null;
		subscriptionHelper.run(this.subscriberFns.deleteDivision, this);
	}

	insertDivision(divisionIndex, division = null) {
		console.log(`Activity.insertDivision, index = ${divisionIndex}`);
		if (!division) {
			division = new ConcurrentStep(this.getEmptyDivisionDefinition(), this);
		}
		this.concurrentSteps.splice(divisionIndex, 0, division);
		this.divisionUuidToObj[division.uuid] = division;
		subscriptionHelper.run(this.subscriberFns.insertDivision, this);
	}

	appendDivision(division = null) {
		console.log('Activity.appendDivision');
		if (!division) {
			division = new ConcurrentStep(this.getEmptyDivisionDefinition(), this);
		} else if (typeof division === 'object' && !(division instanceof ConcurrentStep)) {
			// assume it's a division definition
			division = new ConcurrentStep(division, this);
		} else {
			throw new Error('division must be ConcurrentStep, division definition, or falsy');
		}
		this.concurrentSteps.push(division);
		this.divisionUuidToObj[division.uuid] = division;
		subscriptionHelper.run(this.subscriberFns.appendDivision, this);
	}

	/**
	 * Get the most basic form of a definition of a division for this activity
	 *
	 * @param {boolean} canonical - Whether to get canonical roles or those currently in use. FIXME
	 *                              there's no real reason to get anything but canonical, I think,
	 *                              except that it throws errors in editor UI at the moment.
	 * @param {string|boolean} dummyStepText - If string, make a step with that text for each role.
	 * @return {Object}            Like { simo: { crewA: [], crewB: [], IV: [] }}
	 */
	getEmptyDivisionDefinition(canonical = false, dummyStepText = false) {
		const def = { simo: {} };
		const colKeys = canonical ? this.getCanonicalRoles() : this.getColumns();
		for (const key of colKeys) {
			def.simo[key] = []; // create an empty array of steps for this actor
			if (dummyStepText) {
				def.simo[key].push(dummyStepText);
			}
		}
		return def;
	}

	/**
	 * Add the definition of the task itself (as opposed to a procedure's usage of the task)
	 *
	 * @param {Object} taskDef  All the task info from the task file (steps, etc), e.g. a file
	 *                          within the ./tasks directory of a Maestro project.
	 */
	addTaskDefinition(taskDef) {

		typeHelper.errorIfIsnt(taskDef.title, 'string');
		typeHelper.errorIfIsnt(taskDef.steps, 'array');

		this.setTitle(taskDef.title);

		if (taskDef.roles) {
			this.setRoles(taskDef.roles, false);
		}

		if (taskDef.steps) {
			this.setDivisions(taskDef.steps);
		}

	}

	setRoles(rolesDef, runTimeSync = true) { // was updateRolesDefinitions

		this.rolesDict = {};
		this.rolesArr = [];
		this.actorRolesDict = {};

		// FIXME remove anything in this.actorRolesDict, etc, that isn't in new definition

		for (const role of rolesDef) {
			// console.log('role', role);
			if (!role.name) {
				consoleHelper.error([
					'Roles require a name, none found in role definition',
					role
				], 'Task role definition error');
			}
			this.rolesDict[role.name] = new TaskRole(role, this.taskReqs);
			this.rolesArr.push(this.rolesDict[role.name]);

			// task defines roles, procedure applies actors to roles in TaskRole object. Get
			// "actor" for this task from that.
			const actor = this.rolesDict[role.name].actor;

			this.actorRolesDict[actor] = this.rolesDict[role.name]; // for convenience
		}

		if (runTimeSync) {
			console.log('running time sync after Task.setRoles()');
			this.procedure.setupTimeSync();
		}

		// FIXME this should return false if no changes were made.
		return true;
	}

	/**
	 * Detect and return what columns are present on a task. A given task may
	 * have 1 or more columns. Only return those present in a task, unless ColumnsHandler says
	 * otherwise
	 *
	 * Clarify: This should probably be getColumnKeys()
	 *
	 * @param {boolean} forceReload  Force regen of this.columnsArray
	 * @return {Array}             Array of column names in this task
	 */
	getColumns(forceReload = false) {

		if (this.columnsArray && !forceReload) {
			return this.columnsArray;
		}

		const divisions = this.concurrentSteps;
		const taskColumns = [];
		const taskColumnsHash = {};
		let division,
			colKey,
			actorKey;

		// Loop over the array of divisions, and within that loop over each object of
		// actorKey:[array,of,steps].
		//
		// divisions = [
		//   { IV: [Step, Step, Step] },              // division (row) 0
		//   { IV: [Step], EV1: [Step, Step] },       // division (row) 1
		//   { EV1: [Step, Step], EV2: [Step] }       // division (row) 2
		// ]
		//
		for (division of divisions) {
			for (actorKey in division.subscenes) {
				colKey = this.procedure.ColumnsHandler.getActorColumnKey(actorKey);

				if (!taskColumnsHash[colKey]) {
					// insert into a hash table because lookup is faster than array
					taskColumnsHash[colKey] = true;
				}
			}
		}

		// make sure column available for each defined role+actor, even if that actor doesn't have
		// any steps yet.
		if (this.procedure.ColumnsHandler.alwaysShowRoleColumns) {
			for (const taskRole of this.rolesArr) {
				const colKey = this.procedure.ColumnsHandler.getActorColumnKey(taskRole.actor);
				taskColumnsHash[colKey] = true;
			}
		}

		if (this.procedure.ColumnsHandler.alwaysShowWildcardColumn) {
			try {
				const wildcardColumnKey = this.procedure.ColumnsHandler.getActorColumnKey('*');
				taskColumnsHash[wildcardColumnKey] = true;
			} catch (e) {
				console.error(e);
			}
		}

		// create taskColumns in order specified by procedure
		for (colKey of this.procedure.ColumnsHandler.getColumnKeys()) {
			if (taskColumnsHash[colKey]) {
				taskColumns.push(colKey);
			}
		}

		this.columnsArray = taskColumns;
		return taskColumns;
	}

	getColumnIndex(actorKey) {
		const columnIndexes = this.getColumnIndexes();
		if (typeof columnIndexes[actorKey] === 'undefined') {
			throw new Error(
				`Unknown actor "${actorKey}" passed to getColumnIndex.
				Task =  ${this.title}
				Column index = ${JSON.stringify(columnIndexes)}`
			);
		} else {
			return columnIndexes[actorKey];
		}

	}

	getColumnIndexes() {

		if (this.columnIndexes) {
			return this.columnIndexes;
		}

		this.columnIndexes = {};
		const taskColumns = this.getColumns();

		for (let i = 0; i < taskColumns.length; i++) {
			this.columnIndexes[taskColumns[i]] = i;
		}

		return this.columnIndexes;
	}

	/**
	 * Set the start time of this task for a particular role. Also updates end time if duration is
	 * set.
	 *
	 * @param {string} actor    Role for which to adjust start time, e.g. "crewA"
	 * @param {Duration} time  Duration object specifying start time
	 * @return {Task}          Return this task for method chaining
	 */
	setStartTimeForRole(actor, time) {
		doTimeUpdate(this, actor, 'startTime', time, 'endTime');

		this.procedure.setupTimeSync(); // overkill? Do this less often?

		// allows UI to subscribe to all task events through TasksHandler
		this.procedure.TasksHandler.notifyTaskSubscription('timeUpdates', this);
		return this;
	}

	/**
	 * Set the start time of this task for a particular role. Also updates start time if duration is
	 * set.
	 *
	 * @param {string} actor    Role for which to adjust end time, e.g. "crewA"
	 * @param {Duration} time  Duration object specifying end time
	 * @return {Task}          Return this task for method chaining
	 */
	setEndTimeForRole(actor, time) {
		doTimeUpdate(this, actor, 'endTime', time, 'startTime');

		this.procedure.setupTimeSync(); // overkill? Do this less often?

		// allows UI to subscribe to all task events through TasksHandler
		this.procedure.TasksHandler.notifyTaskSubscription('timeUpdates', this);
		return this;
	}

	/**
	 * Set the duration of this task for a particular role. Also updates end time if start time is
	 * set.
	 *
	 * @param {string} actor       Role for which to adjust end time, e.g. "crewA"
	 * @param {Duration} time      Duration object specifying duration
	 * @return {Task}              Return this task for method chaining
	 */
	setDurationForRole(actor, time) {
		doTimeUpdate(this, actor, 'duration', time, 'endTime');

		this.procedure.setupTimeSync(); // overkill? Do this less often?

		// allows UI to subscribe to all task events through TasksHandler
		this.procedure.TasksHandler.notifyTaskSubscription('timeUpdates', this);
		return this;
	}

	getDivisionIndexByUuid(uuid) {
		for (let i = 0; i < this.concurrentSteps.length; i++) {
			if (this.concurrentSteps[i].uuid === uuid) {
				return i;
			}
		}
		return -1;
	}

	getDivisionByUuid(uuid, allowMissing = false) {
		const index = this.getDivisionIndexByUuid(uuid);
		if (index === -1 || index > this.concurrentSteps.length - 1) {
			if (allowMissing) {
				return false;
			}
			throw new Error(`Division with uuid ${uuid} not found`);
		}
		return this.concurrentSteps[index];
	}

	// create Task.canonicalRoles ==> task.rolesArr.map((taskRole) => taskRole.name)
	//                                 +  procedure.getAstreriskColumnKey()

	/**
	 * Get roles defined in this task (e.g. this.rolesArr, etc) _plus_ the procedure's column key
	 * for the column with a wildcard actor ('*') if it exists.
	 *
	 * @return {Array}  Like ['crewA', 'crewB', 'IV']
	 */
	getCanonicalRoles() {
		// get array like ['crewA', 'crewB']
		const canonical = this.rolesArr.map((taskRole) => taskRole.name);
		try {
			canonical.push(this.procedure.ColumnsHandler.getActorColumnKey('*'));
		} catch (e) {
			console.log('No wildcard column');
		}
		return canonical;
	}

	getNumStepsPriorToDivision(division) {
		let totalSteps = 0;
		for (let i = 0; i < this.concurrentSteps.length; i++) {
			if (division !== this.concurrentSteps[i]) {
				totalSteps += this.concurrentSteps[i].getTotalSteps();
			} else {
				return totalSteps;
			}
		}
		throw new Error(`ConcurrentStep ${division.uuid} not within Task ${this.uuid}`);
	}

	getTotalSteps() {
		let totalSteps = 0;
		for (const division of this.concurrentSteps) {
			totalSteps += division.getTotalSteps();
		}
		return totalSteps;
	}

	getDivisionIndex(division) {
		for (let i = 0; i < this.concurrentSteps.length; i++) {
			if (division === this.concurrentSteps[i]) {
				return i;
			}
		}
		throw new Error(`Division ${division.uuid} not found in ${this.uuid}`);
	}

};
