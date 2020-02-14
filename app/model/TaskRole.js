'use strict';

const consoleHelper = require('../helpers/consoleHelper');
const Duration = require('./Duration');

module.exports = class TaskRole {

	/**
	 * Constructor for TaskRole
	 * @param  {Object} roleDef           Example:
	 *                                      { name: 'crewA',
	 *                                        description: 'Person who does XYZ'
	 *                                        duration: { minutes: 20 } }
	 * @param  {Object} taskRequirements  Info about this usage of task from procedure file. Ex:
	 *                                      { file: 'colka-temporary-lid-removal.yml',
	 *                                        roles: { crewA: 'EV1', crewB: 'EV2' },
	 *                                        color: '#7FB3D5' }
	 */
	constructor(roleDef, taskRequirements) {
		this.name = roleDef.name;
		this.description = roleDef.description;
		this.duration = new Duration(roleDef.duration);
		if (!taskRequirements || !taskRequirements.roles || !taskRequirements.roles[this.name]) {
			consoleHelper.error([
				'Roles defined within tasks must be filled by procedure actors',
				`Within task "${taskRequirements.file}", role "${this.name}" is defined`,
				`Within the procedure, role "${this.name}" is not filled by an actor`
			], 'TaskRole error');
		} else {
			this.actor = taskRequirements.roles[this.name];
		}
	}

	getDefinition() {
		const def = {
			name: this.name,
			duration: this.duration ? this.duration.getDefinition() : { seconds: 0 }
		};
		if (this.description) {
			def.description = this.description;
		}
		return def;
	}
};
