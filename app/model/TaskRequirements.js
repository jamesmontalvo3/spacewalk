'use strict';

const typeHelper = require('../helpers/typeHelper');

module.exports = class TaskRequirements {

	/**
	 * Generate a TaskRequirements object. Why "requirements"? Because this is the info passed in
	 * from the procedure, about how the procedure is implementing the task. The procedure
	 * _requires_ that Task A is performed with EV1 fills the crewB role.
	 *
	 * @param {Object} definition  The definition/requirements of the task specified by the
	 *                             procedure. Example in YAML:
	 *                               - file: US EVA COLKA-POST DEPRESS & EGRESS-SETUP.yml
	 *                                 roles:
	 *                                   crewA: EV1
	 *                                   crewB: EV2
	 *                                 color: "#D6D6D6"
	 * @param {Task} task          Reference to the Task object that this TaskRequirements object is
	 *                             specifying.
	 */
	constructor(definition, task) {

		// this has to be done here to avoid circular references
		const Task = require('./Task');
		typeHelper.errorIfIsnt(task, Task);
		this.task = task;

		this.updateDefinition(definition);
	}

	updateDefinition(definition) {
		typeHelper.errorIfIsnt(definition.file, 'string');
		typeHelper.errorIfIsnt(definition.roles, 'object-not-array');

		this.setFile(definition.file);

		this.roles = this.cloneRoles(definition.roles);

		// if definition has color set, update to that color. If not, and this.color was set, unset
		if (definition.color) {
			this.color = definition.color;
		} else if (this.color) {
			delete this.color;
		}
	}

	setFile(file) {
		const changed = this.file !== file;

		this.file = file;

		// FIXME: Pick one. Both are used currently. Maybe only set it on this object, not on Task
		this.task.file = file;
		this.task.filename = file;

		return changed;
	}

	cloneRoles(source) {
		const cloned = {};
		for (const role in source) {
			cloned[role] = source[role];
		}
		return cloned;
	}

	getDefinition() {
		return {
			file: this.file,
			roles: this.cloneRoles(this.roles),
			color: this.color || '#FFFFFF'
		};
	}

};
