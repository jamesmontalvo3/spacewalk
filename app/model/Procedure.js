'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const filenamify = require('filenamify');

const ColumnsHandler = require('./ColumnsHandler');
const TasksHandler = require('./TasksHandler');
// const Task = require('./Task');
const validateSchema = require('../schema/validateSchema');
const Duration = require('./Duration');
const TimeSync = require('./TimeSync');
const consoleHelper = require('../helpers/consoleHelper');

function translatePath(procedureFilePath, taskFileName) {
	// Look in tasks directory, sister to procedures directory
	// Someday look in a directory provided by dependency manager, issue #21
	const taskFilePath = path.join(
		path.dirname(procedureFilePath),
		'..',
		'tasks',
		taskFileName
	);

	// Validate & Load the yaml file!
	if (!fs.existsSync(taskFilePath)) {
		throw new Error(`Could not find task file ${taskFilePath}`);
	}

	return taskFilePath;
}

module.exports = class Procedure {

	constructor() {
		this.name = '';
		this.number = '';
		this.uniqueId = '';
		this.book = '';
		this.applicability = '';
		this.version = '';
		this.procCode = '';
		this.location = '';
		this.duration = '';
		this.crewRequired = '';
		this.parts = [];
		this.materials = [];
		this.tools = [];
		this.referencedProcedures = '';
		this.filename = '';
		this.actors = [];

		// this.columns = []; // <-- switch to model below instead
		this.ColumnsHandler = new ColumnsHandler();
	}

	getDefinition() {

		const procedure = {
			// eslint-disable-next-line camelcase
			procedure_name: this.name,
			columns: this.ColumnsHandler.getDefinition(),
			tasks: this.TasksHandler.getRequirementsDefinitions()
		};

		return {
			procedureDefinition: procedure,
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
		this.filename = filenamify(value.replace(/\s+/g, '_'));
	}

	/**
	 * Populates data, reading in the specified file.
	 * @param {string} fileName The full path to the YAML file
	 * @return {Error|null}
	 */
	addProcedureDefinitionFromFile(fileName) {
		this.procedureFile = fileName;

		if (!fs.existsSync(fileName)) {
			return new Error(`Could not find file ${fileName}`);
		}

		const procDef = YAML.safeLoad(fs.readFileSync(fileName, 'utf8'));

		const err = this.addProcedureDefinition(procDef);
		if (err) {
			return err;
		}

		this.loadTaskDefinitionsFromFiles();
		this.setupTimeSync();
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
		if (procDef.metaData) {
			const ipvFileName = [procDef.procedure_number, procDef.metaData.uniqueid].join('_');
			this.filename = filenamify(ipvFileName.replace(/\s+/g, '_'));
			this.uniqueId = procDef.metaData.uniqueid;
			this.book = procDef.metaData.book;
			this.applicability = procDef.metaData.applicability;
			this.version = procDef.metaData.version;
			this.procCode = procDef.metaData.procCode;
		}
		this.objective = procDef.procedure_objective;
		this.location = procDef.LOCATION;
		this.duration = procDef.DURATION;
		this.crewRequired = procDef.CREW;
		this.parts = procDef.parts;
		this.materials = procDef.materials;
		this.tools = procDef.tools;
		this.referencedProcedures = procDef.referencedProcedures;

		if (procDef.columns) {
			this.ColumnsHandler.updateColumns(procDef.columns);
		}

		this.TasksHandler = new TasksHandler(procDef.tasks, this);

		// FIXME: Do this for now, rather than fixing all the cases of procedure.tasks out there...
		this.tasks = this.TasksHandler.tasks;

		return null;
	}

	loadTaskDefinitionsFromFiles() {

		if (!this.TasksHandler) {
			throw new Error('this.TasksHandler must be set first');
		}

		const taskDefinitions = {};

		for (const task of this.TasksHandler.tasks) {
			// Since the task file is in relative path to the procedure
			// file, need to translate it!
			const taskFileName = translatePath(this.procedureFile, task.file);
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
		for (const currentTask of this.tasks) {
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

		this.timeSync = new TimeSync(this.tasks, false);
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

};
