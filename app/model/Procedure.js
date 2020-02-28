'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const filenamify = require('filenamify');
const cloneDeep = require('lodash/cloneDeep');

const ColumnsHandler = require('./ColumnsHandler');
const TasksHandler = require('./TasksHandler');
// const Task = require('./Task');
const validateSchema = require('../schema/validateSchema');
const Duration = require('./Duration');
const TimeSync = require('./TimeSync');
const consoleHelper = require('../helpers/consoleHelper');
const arrayHelper = require('../helpers/arrayHelper');
const Indexer = require('./Indexer');

/**
 * Get path to task file relative to procedure file, or throw error.
 *
 * @param {string} procedureFilePath  Path to procedure file
 * @param {string} taskFileName       Name of task file at ../tasks/${taskFileName} relative to proc
 * @return {string}
 */
function translatePath(procedureFilePath, taskFileName) {
	// Look in tasks directory, sister to procedures directory
	// Someday look in a directory provided by dependency manager, issue #21
	const taskFilePath = path.join(
		path.dirname(path.dirname(procedureFilePath)),
		'tasks',
		taskFileName
	);

	// Validate & Load the yaml file!
	if (!fs.existsSync(taskFilePath)) {
		throw new Error(`Could not find task file ${taskFilePath}`);
	}

	return taskFilePath;
}

const ipvFieldDefinitions = {

	// Several numbers...if there was just one number then you could call it a generic procedure
	// number, but with so many it becomes confusing and should be encapsulated as IPV specific
	number: ['string', 'Procedure number like X.X.XXX'],
	mNumber: ['string', 'Within IPV known as Unique ID, like M_12345'],
	procCode: ['string', 'IPV procedure code such as ISS IFM/E58 - ALL/FIN'],

	book: ['string', 'IPV book that procedure is published to'],
	applicability: ['string', 'Procedure applicability such as E58 - ALL'],
	ipvVersion: ['string', 'Version of this procedure.'],

	procedureobjective: ['string', 'Procedure objective which describes purpose/assumptions of procedure'],

	crewRequired: ['array', 'How many crew members are required for the procedure'], // IPV way of annotating options; maybe someday Maestro handle

	// These may all get replaced/managed by some higher-level state handler at some point. To
	// simplify refactoring them, I think it makes sense to move them under an IPV header
	parts: ['array', 'Parts used in procedure'],
	materials: ['array', 'Materials used in procedure'],
	tools: ['array', 'Tools used in procedure'],
	ipvLocation: ['array', 'Description of location(s) where procedure is performed'],
	// will have this concept, but not yet. So encapsulate in ipvFields. Sometime sooner than having
	// options there may be added a top-level Duration object, like `new Duration({hours: 6,
	// minutes: 30})` to say that EVAs should be 6:30, and if activities cause deviation from this
	// time then a warning should be given.
	ipvDuration: ['array', 'Description of how long procedure will take to perform'],

	referencedProcedures: ['array', 'IPV procedures referenced in this procedure']
};

module.exports = class Procedure {

	constructor(options = {}) {

		this.name = '';
		this.filename = '';
		this.actors = [];
		this.indexer = new Indexer();

		// this.columns = []; // <-- switch to model below instead
		this.ColumnsHandler = new ColumnsHandler(false, options);
	}

	getOnlyProcedureDefinition() {
		const def = {
			// eslint-disable-next-line camelcase
			procedure_name: this.name,
			columns: this.ColumnsHandler.getDefinition(),
			tasks: this.TasksHandler.getRequirementsDefinitions()
		};

		if (this.ipvFields) {
			for (const key in this.ipvFields) {
				if (Array.isArray(this.ipvFields[key])) {
					def[key] = cloneDeep(this.ipvFields[key]); // creates shallow clone of array
				} else {
					def[key] = this.ipvFields[key]; // assume scalar (currently no objects)
				}
			}
		}

		return def;
	}

	getDefinition() {
		return {
			procedureDefinition: this.getOnlyProcedureDefinition(),
			taskDefinitions: this.TasksHandler.getTaskDefinitions()
		};
	}

	getActorsInLeadRoles() {
		const actorsDict = {};
		const actorsArr = [];
		for (const task of this.tasks) {
			for (const role of task.rolesArr) {
				if (!actorsDict[role.actor]) {
					actorsDict[role.actor] = true;
				}
			}
		}
		for (const actor in actorsDict) {
			actorsArr.push(actor);
		}
		return actorsArr;
	}

	getTasksWithActorInLeadRole(actorKey) {
		const actorTasks = [];
		for (const task of this.tasks) {
			if (task.actorRolesDict[actorKey]) {
				actorTasks.push(task);
			}
		}
		return actorTasks;
	}

	/**
	 * From the column definition in this procedure's YAML file, create an array of all defined
	 * actors. This does NOT mean that other actors/roles are not present in the procedure. They
	 * just may not have an explicit definition of which column to fall under.
	 *
	 * See also getColumnsOfActorsFillingRoles()
	 *
	 * @param {boolean} includeWildcard  Whether or not to include a '*' element in the array
	 * @return {Array}                   Array of actors
	 */
	getAllActorsDefinedInColumns(includeWildcard = false) {
		const allActors = [];
		for (const col of this.ColumnsHandler.columns) {
			for (const actor of col.actors) {
				if (includeWildcard || actor !== '*') {
					allActors.push(actor);
				}
			}
		}
		return allActors;
	}

	/**
	 * Creates an array of actors within the columns their steps are displayed. Example:
	 *
	 * [
	 *   ['IV', 'SSRMS'],  <-- first column has two actors
	 *   ['EV1'],          <-- Second and third column have one actor, but still are in arrays
	 *   ['EV2']
	 * ]
	 *
	 * Note that actors are only present here if they are _filling roles_. Just because there is a
	 * step like this:
	 *
	 * - step: Do some robotics stuff
	 *   actor: ROBO
	 *
	 * This ^ does not mean that the actor "ROBO" will be present in the array returned by this
	 * function. For that to happen, "ROBO" must fulfill a role via the procedure YAML file, e.g.:
	 *
	 * tasks:
	 *  - file: some_task.yml
	 *    roles:
	 *      a_role_name: ROBO  <-- Within the procedure YAML file "ROBO" is the input to a task role
	 *
	 * ALSO NOTE that the returned array _may_ have empty elements, e.g. [<empty>, 'EV1', 'EV2'],
	 * meaning there are no actors filling roles in the column with index = 0. To remove empty
	 * elements set includeEmpty = false
	 *
	 * @param {boolean} includeEmpty  Whether or not to include empty elements
	 * @return {Array}                2-dimensional array of actors in columns
	 */
	getColumnsOfActorsFillingRoles(includeEmpty = true) {

		/**
		 * Creates actorColumnIndexes like:
		 * actorColumnIndexes = {
		 *   IV: 0,
		 *   SSRMS: 0,
		 *   EV1: 1,
		 *   EV2: 2
		 * }
		 */
		const actorColumnIndexes = {};
		for (const task of this.tasks) {
			for (const actor in task.actorRolesDict) {
				if (!actorColumnIndexes[actor]) {
					actorColumnIndexes[actor] = this.ColumnsHandler.getActorColumnIndex(actor);
				}
			}
		}

		const columns = [];
		for (const actor in actorColumnIndexes) {
			const index = actorColumnIndexes[actor];
			if (!columns[index]) {
				columns[index] = [];
			}
			columns[index].push(actor);
		}

		if (includeEmpty) {
			return columns;
		}

		// strip out empty columns if desired
		return columns.filter((cur) => {
			return Boolean(cur);
		});

	}

	/**
	 * Procedures may have intended durations (e.g. common EVA length is 6 hours 30 minutes), but
	 * the actual duration based upon summing task times may differ.
	 *
	 * @return {Duration} Duration object representing end time of last task
	 */
	getActualDuration() {
		let longestEndTime;

		for (const actor in this.taskEndpoints) {
			const actorEndTime = this.taskEndpoints[actor] // for this actor get first/last task
				.last // choose the last task
				.actorRolesDict[actor] // .last points to task; within task, select actor's role
				.endTime; // get the time this actor finishes this (last) task

			if (!longestEndTime ||
				actorEndTime.getTotalSeconds() > longestEndTime.getTotalSeconds()
			) {
				longestEndTime = actorEndTime;
			}
		}

		// return a clone of the longest end time, in case the task moves
		return longestEndTime.clone();
	}

	setName(value) {
		this.name = value;
		this.filename = filenamify(value.replace(/\s+/g, '_')); // FIXME this doesn't have .yml ?!?!
		// FIXME also how does this jive with this.procedureFile
		// use helpers/yamlFileNamify
	}

	/**
	 * Populates data, reading in the specified file.
	 * @param {string} procedureFilepath The full path to the YAML file
	 * @return {Error|null}
	 */
	addProcedureDefinitionFromFile(procedureFilepath) {
		this.procedureFile = path.basename(procedureFilepath);
		this.procedureFilepath = procedureFilepath;

		if (!fs.existsSync(procedureFilepath)) {
			return new Error(`Could not find file ${procedureFilepath}`);
		}

		const procDef = YAML.safeLoad(fs.readFileSync(procedureFilepath, 'utf8'));

		const err = this.addProcedureDefinition(procDef);
		if (err) {
			return err;
		}

		this.loadTaskDefinitionsFromFiles();
		this.setupTimeSync();
		this.setupIndex();
	}

	setupIndex() {
		const indexer = this.indexer;
		for (const uuid in indexer.index) {
			if (indexer.index[uuid].type !== 'Step') {
				continue;
			}
			const step = indexer.index[uuid].item;
			const { prev, next } = step.getAdjacentActivitySteps();
			const prevUuid = prev ? prev.uuid : null;
			const nextUuid = next ? next.uuid : null;
			indexer.alter(uuid, { prevUuid, nextUuid });
		}
	}

	/**
	 *
	 * @param {Object} procDef  Procedure definition in JS object form (not YAML/JSON string)
	 * @return {null|SchemaValidationError}  If schema validation errors found, returns err object
	 */
	addProcedureDefinition(procDef) {

		// Load and validate the input file
		try {
			validateSchema('procedure', procDef);
		} catch (err) {
			return err;
		}

		// Save the procedure Name
		this.setName(procDef.procedure_name);
		this.number = procDef.procedure_number;

		this.handleIpvFields(procDef.ipvFields);

		if (procDef.columns) {
			this.ColumnsHandler.updateColumns(procDef.columns);
		}

		this.TasksHandler = new TasksHandler(procDef.tasks, this);

		// FIXME: Do this for now, rather than fixing all the cases of procedure.tasks out there...
		this.tasks = this.TasksHandler.tasks;

		return null;
	}

	handleIpvFields(ipvFields) {
		if (!ipvFields) {
			delete this.ipvFields; // in case it previously existed and was removed in editor UI
			return;
		}

		this.ipvFields = {};
		for (const key in ipvFieldDefinitions) {
			const type = ipvFieldDefinitions[key][0];
			// const description = ipvFieldDefinitions[key][1];
			if (type === 'array') {
				this.ipvFields[key] = arrayHelper.parseArray(ipvFields[key] || []);
			} else if (type === 'string') {
				this.ipvFields[key] = ipvFields[key] || '';
			} else {
				throw new Error('IPV fields only currently supports string or array');
			}
		}
	}

	loadTaskDefinitionsFromFiles() {

		if (!this.TasksHandler) {
			throw new Error('this.TasksHandler must be set first');
		}

		const taskDefinitions = {};

		for (const task of this.TasksHandler.tasks) {
			// Since the task file is in relative path to the procedure
			// file, need to translate it!
			const taskFileName = translatePath(this.procedureFilepath, task.file);
			taskDefinitions[task.file] = YAML.safeLoad(fs.readFileSync(taskFileName, 'utf8'));
		}

		const err = this.updateTaskDefinitions(taskDefinitions);
		if (err) {
			throw err;
		}

	}

	/**
	 * @param {Object} taskDefs  Object map of task file names to task definitions, in JS object
	 *                           form (not YAML/JSON string). Example:
	 *                           var taskDefs = {
	 *                             'my-task.yml': {
	 *                               title: 'sometitle',
	 *                               roles: [...],
	 *                               steps: [...]
	 *                             },
	 *                             'another-task.yml': { ... }, ...
	 *                           }
	 * @return {null|SchemaValidationError}  If schema validation errors found, returns err object
	 */
	updateTaskDefinitions(taskDefs) {

		for (const taskFile in taskDefs) {
			const err = this.updateTaskDefinition(taskFile, taskDefs[taskFile]);
			if (err) {
				return err;
			}
		}

		return null;
	}

	/**
	 * @param {string} taskFile              Task filename, as written in procedure file.
	 * @param {Object} taskDef               Single task definition. JS object not YAML/JSON string.
	 * @return {null|SchemaValidationError}  If schema validation errors found, returns err object
	 */
	updateTaskDefinition(taskFile, taskDef) {

		if (!this.TasksHandler) {
			throw new Error('Must setup procedure.TasksHandler first');
		}

		// info about task from procedure file
		const task = this.TasksHandler.getTaskByFile(taskFile);

		try {
			validateSchema('task', taskDef);
		} catch (err) {
			return err;
		}

		task.addTaskDefinition(taskDef);

		return null;
	}

	setupTimeSync() {

		// For each role, make a pointer to the latest (most recent) activity
		const roleLatestAct = {};

		// Loop over all tasks and all roles within those tasks
		for (const currentTask of this.TasksHandler.tasks) {
			for (const role in currentTask.actorRolesDict) {

				// If the role has a defined latest activity
				if (roleLatestAct[role]) {

					// set currentTask's previous task to be the last-added task for this role
					currentTask.actorRolesDict[role].prevTask = roleLatestAct[role];

					// set the last-added task's _next_ task to be the currentTask
					roleLatestAct[role].actorRolesDict[role].nextTask = currentTask;

					// start time of this task (for this role) is the end time of the previous task
					// (for this role)
					currentTask.actorRolesDict[role].startTime =
						roleLatestAct[role].actorRolesDict[role].endTime;

				} else {
					// No latest (aka previous) activity for this role, so initially assume this
					// activity starts at time zero
					currentTask.actorRolesDict[role].startTime = new Duration({ seconds: 0 });
				}

				// end time of this task (for this role) is the start + duration
				currentTask.actorRolesDict[role].endTime = Duration.sum(
					currentTask.actorRolesDict[role].startTime,
					currentTask.actorRolesDict[role].duration
				);

				// make the current task be the last added task
				roleLatestAct[role] = currentTask;

			}
		}

		this.timeSync = new TimeSync(this.TasksHandler.tasks, false);
		this.timeSync.sync();
		this.taskEndpoints = this.timeSync.endpoints();

	}

	handleParsingError(err, file) {
		// Check if an error occurred
		if (err && err instanceof Error) {
			consoleHelper.noExitError(`Error while processing procedure ${file}: ${err}`);
			if (err.validationErrors) {
				consoleHelper.noExitError('Validation Errors:');
				consoleHelper.noExitError(err.validationErrors);
			}
			return;
		}
	}

	getTaskByUuid(uuid, allowMissing = false) {
		const index = this.TasksHandler.getTaskIndexByUuid(uuid);
		if (index === -1 || index > this.tasks.length - 1) {
			if (allowMissing) {
				return null;
			} else {
				throw new Error(`Task with uuid ${uuid} not found`);
			}
		}
		return this.tasks[index];
	}

	getNumStepsPriorToActivity(activity) {
		let totalSteps = 0;
		for (let i = 0; i < this.tasks.length; i++) {
			if (activity !== this.tasks[i]) {
				totalSteps += this.tasks[i].getTotalSteps();
			} else {
				return totalSteps;
			}
		}
		throw new Error(`Task ${activity.uuid} not within Procedure ${this.procedure_name}`);
	}

};
