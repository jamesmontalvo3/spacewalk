'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const packageJson = require('../../package.json');
const envHelper = require('../helpers/envHelper');

const noGitMessage = 'Git not available in browser';

/**
 * Run a git command in the projectPath and return its output
 *
 * @param {string} projectPath
 * @param {string} cmd
 * @return {string}
 */
function runGitCmd(projectPath, cmd) {
	let output;

	try {
		output = childProcess
			.execSync(`cd ${projectPath} && ${cmd}`)
			.toString()
			.trim();
	} catch (err) {
		console.error(err);
	}

	return output;
}

/**
 * Perform 'git rev-parse' or 'git log' commands
 * @param {Program} program  Program object, e.g. CommanderProgram, WebProgram, ElectronProgram
 * @param {string} type      Either 'hash' or 'date', to run 'git rev-parse' or 'git log'
 * @return {string}          Return output of git functions, or message stating Git isn't available
 *                           in browser.
 */
function getDateOrHash(program, type) {

	const types = {
		hash: {
			prop: 'gitHash',
			cmd: 'git rev-parse --short HEAD',
			noRepoText: 'NO VERSION (NOT CONFIG CONTROLLED)'
		},
		date: {
			prop: 'gitDate',
			cmd: 'git log -1 --format=%cd --date=iso8601',
			noRepoText: 'NO DATE (NOT CONFIG CONTROLLED)'
		}
	};
	const prop = types[type].prop;

	// This was done because the status of a git repo shouldn't change from the time the CLI command
	// `maestro compose` was run until the time the output files were generated. It made sense to
	// cache the values rather than risk running git commands again. That assumption does not matter
	// (as of this writing) in the browser context, since there is no way to get git data (yet). In
	// the Electron context the git status can change, however, and this will need to be updated.
	// FIXME ^
	if (program[prop]) {
		return program[prop];
	}

	if (envHelper.isBrowser) {
		program[prop] = noGitMessage;
		return program[prop];
	}

	program[prop] = fs.existsSync(program.gitPath) ?
		runGitCmd(program.projectPath, types[type].cmd) :
		types[type].noRepoText;

	return program[prop];
}

module.exports = class Program {

	constructor() {
		this.name = 'Maestro';
		this.version = packageJson.version;
		this.fullName = `${this.name} v${this.version}`;
		this.repoURL = packageJson.repository.url;
		this.description = packageJson.description;
	}

	/**
	 * OPTIMIZE: Instead of using child_process, dig into .git directory. Or use
	 * an npm package for dealing with git.
	 *
	 * ADD FEATURE: Consider `git describe --tags` if tags are available. That
	 * will be easier for people to understand if a version they are looking at
	 * is significantly different. Something like semver. If version is = X.Y.Z,
	 * then maybe version changes could be:
	 *
	 *    Changes to X = Adding/removing significant tasks from a procedure
	 *    Changes to Y = ??? Adding/removing/modifying steps or adding/removing
	 *                   insignificant tasks.
	 *    Changes to Z = Fixes and minor clarifications. Changes should not
	 *                   affect what crew actually do.
	 *
	 * @return {string} First 8 characters of git hash for project
	 */
	getGitHash() {
		return getDateOrHash(this, 'hash');
	}

	/**
	 * @return {string|boolean}  False if no uncommitted changes. "X uncommitted change(s)" if any.
	 */
	getGitUncommittedChanges() {

		if (this.gitUncommittedChanges) {
			return this.gitUncommittedChanges;
		}

		if (envHelper.isBrowser) {
			this.gitUncommittedChanges = noGitMessage;
			return this.gitUncommittedChanges;
		}

		this.gitUncommittedChanges = false;

		if (fs.existsSync(this.gitPath)) {
			const uncommitted = runGitCmd(this.projectPath, 'git status --porcelain').split('\n');
			if (uncommitted.length > 1 || uncommitted[0] !== '') {
				const plural = uncommitted.length === 1 ? '' : 's';
				this.gitUncommittedChanges = `${uncommitted.length} uncommitted change${plural}`;
			}
		}

		return this.gitUncommittedChanges;
	}

	/**
	 * Get the date of the HEAD commit
	 *
	 * @return {string} Date in iso8601 format
	 */
	getGitDate() {
		return getDateOrHash(this, 'date');
	}

	/**
	 * Currently returns empty string. Someday actually get user info from git repo.
	 * @return {string}  Currently just returns ''. Someday return 'User Name<user.name@example.com'
	 */
	getLastModifiedBy() {
		return '';
	}

	getProjectProcedureFiles() {
		return fs.readdirSync(this.proceduresPath).filter((filename) => {
			return filename.endsWith('.yml');
		});
	}

	setPathsFromProject(projectPath = false) {

		// property on this object --> directory name
		const paths = {
			proceduresPath: 'procedures',
			tasksPath: 'tasks',
			imagesPath: 'images',
			outputPath: 'build',
			gitPath: '.git'
		};

		if (projectPath) {
			this.projectPath = projectPath;
			for (const prop in paths) {
				const dir = paths[prop];
				this[prop] = path.join(projectPath, dir);
			}
		} else {
			for (const prop in paths) {
				const dir = paths[prop];
				this[prop] = dir;
			}
		}

	}

	moveFile(originalPath, newPath, successHandler = null, errorHandler = null) {

		const genericResponseHandler = function(result) {
			console.log(result.msg);
			return;
		};

		if (!successHandler) {
			successHandler = genericResponseHandler;
		}

		if (!errorHandler) {
			errorHandler = genericResponseHandler;
		}

		const formatResponse = function(success, msg, error = undefined) {
			return {
				success: success,
				msg: msg,
				originalPath,
				newPath,
				error
			};
		};

		// FIXME fs.exists deprecated
		fs.exists(originalPath, function(currentExists) {
			if (!currentExists) {
				return errorHandler(
					formatResponse(false, 'ERROR: original file path doesn\'t exist')
				);
			}

			fs.exists(newPath, function(newExists) {
				if (newExists) {
					return errorHandler(
						formatResponse(false, 'ERROR: file already exists at new file path')
					);
				}

				fs.rename(originalPath, newPath, function(err) {
					if (err) {
						return errorHandler(
							formatResponse(false, err.message, err)
						);
					}

					return successHandler(
						formatResponse(true, `${originalPath} moved to ${newPath}`)
					);
				});
			});
		});
	}

};
