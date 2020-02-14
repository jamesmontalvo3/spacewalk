'use strict';

const YAML = require('js-yaml');

const Program = require('./Program');
const Procedure = require('./Procedure');

/**
 * Helper function to streamline using Fetch API
 *
 * @param {string} uri  URI to pass to fetch API
 * @return {Promise}    Promise passing fetch's reponse.text()
 */
function fetchFileText(uri) {
	return fetch(encodeURI(uri))
		.then((response) => {
			return response.text();
		});
}

module.exports = class WebProgram extends Program {

	constructor(reactAppComponent) {
		super();
		this.setPathsFromProject(false);
		this.gitPath = '[NO GIT PATH IN BROWSER]';
		this.isElectron = false;
		this.reactAppComponent = reactAppComponent; // bind react App component to this
		this.reactAppComponent.setProgram(this); // bind this to react App component
	}

	/**
	 * @param {string} procedureFilename  File name of procedure, not full path.
	 * @return {Promise}
	 */
	loadProcedure(procedureFilename) {

		this.procedure = new Procedure({
			alwaysShowRoleColumns: true,
			alwaysShowWildcardColumn: true
		});
		this.procedure.procedureFile = procedureFilename;

		return new Promise((resolveOuter, rejectOuter) => {
			fetchFileText(`procedures/${procedureFilename}`)
				.then((text, reject) => {
					const err = this.procedure.addProcedureDefinition(YAML.safeLoad(text));
					if (err) {
						reject(new Error(err));
					} else {
						console.log('Procedure loaded. See maestro.app.procedure');
						const taskLoadPromises = [];
						for (const task of this.procedure.TasksHandler.tasks) {
							taskLoadPromises.push(this.loadTask(task.file));
						}
						Promise.all(taskLoadPromises)
							.then(() => {
								this.procedure.setupTimeSync();
								this.procedure.setupIndex();
								resolveOuter();
							})
							.catch((error) => {
								rejectOuter(error);
							});
					}
				});

		});
	}

	loadTask(taskFilename) {
		if (!this.procedure) {
			return Promise.reject(new Error('Must load procedure for loading tasks'));
		}

		return new Promise((resolve, reject) => {
			fetchFileText(`tasks/${taskFilename}`)
				.then((text) => {
					const err = this.procedure.updateTaskDefinition(
						taskFilename,
						YAML.safeLoad(text)
					);
					if (err) {
						reject(new Error(err));
					} else {
						resolve(true);
					}
				});

		});
	}

};
