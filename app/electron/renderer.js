'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const shell = require('electron').shell;

const { ipcRenderer } = require('electron');

const ElectronProgram = require('../model/ElectronProgram');

const gitCmd = function(projectPath, cmd) {
	return childProcess
		.execSync(`cd ${projectPath} && ${cmd}`)
		.toString()
		.trim();
};

// Handles fresult of selecting a procedure file after doing File-->Open
// FIXME: No error handling for invalid file (i.e. not a procedure file)
ipcRenderer.on('procedureSelected', function(event, filepath) {
	console.log('ipcRenderer.on --> procedureSelected');
	console.log(event);
	console.log(filepath);
	window.maestro.app.loadProcedure(filepath);
});

// Handles result of selecting a directory after doing File-->New Project
ipcRenderer.on('initNewProject', function(event, dirpath) {
	console.log('ipcRenderer.on --> initNewProject');
	console.log(event);
	console.log(dirpath);
	window.maestro.state.setState({

		// FIXME: If this is the last item in this object, then it does not get set. That indicates
		// that there is an issue with setting modalType that is silently failing.
		initProjectParentPath: dirpath,
		modalVisible: true,
		modalType: 'INIT_PROJECT' // FIXME why does this have to be last?
	});
	console.log('state now', window.maestro.state.state);
});

if (!window.maestro) {
	window.maestro = {};
}
window.maestro.app = new ElectronProgram(window.appComponent);

// FIXME: documentation. This function has to be here because this file is not run through Webpack,
// and the child_process module cannot be webpacked. Though that doesn't actually apply to Electron
// necessarily since its webpack target is 'electron-preload' instead of 'web'
window.maestro.exportToWord = function(procedureOutputFilename, successFn, failureFn) {
	const maestroEntry = path.resolve(__dirname, '../../index.js');
	const projectPath = window.maestro.app.projectPath;
	childProcess.exec(
		`node "${maestroEntry}" compose --eva-docx "${projectPath}"`,
		(error, stdout, stderr) => {
			if (error) {
				failureFn(error, stdout, stderr);
			} else {
				successFn(stdout, stderr);
				shell.openItem(path.join(projectPath, 'build', procedureOutputFilename));
			}
		}
	);
};

// See FIXME above
window.maestro.initGitRepoAndFirstCommit = function(projectPath) {
	const output = [];
	const commands = [
		'git init',
		'git add .',
		'git commit -m "Initial commit"'
	];

	for (const cmd of commands) {
		try {
			console.log(`Running git command on new repository: ${cmd}`);
			output.push(
				// FIXME don't use sync version here
				childProcess
					.execSync(`cd ${projectPath} && ${cmd}`)
					.toString()
					.trim()
			);
		} catch (error) {
			console.error(error);
			return { error, output };
		}
	}
	return { output };
};

// FIXME see above
window.maestro.getGitDiff = function() {
	const projectPath = window.maestro.app.projectPath;

	const output = [];
	const commands = [
		'git add .',
		'git diff --staged'
	];

	for (const cmd of commands) {
		try {
			console.log(`Running git command on new repository: ${cmd}`);
			output.push(
				// FIXME don't use sync version here
				childProcess
					.execSync(`cd ${projectPath} && ${cmd}`)
					.toString()
					.trim()
			);
		} catch (error) {
			console.error(error);
			return { error, output };
		}
	}
	return { output };
};

// FIXME see above
window.maestro.gitCommit = function(summary, description = '') {
	const projectPath = window.maestro.app.projectPath;

	let commitMsg = summary.trim();
	if (description) {
		commitMsg += `\n\n${description.trim()}`;
	}

	const commitMsgFile = path.join(projectPath, '.commitmsg');
	fs.writeFileSync(commitMsgFile, commitMsg);

	const output = [];
	const commands = [];

	const username = os.userInfo().username;
	let branches, currentBranch, userChangesBranch;
	if (username) {
		userChangesBranch = `${username}-changes`;
		branches = gitCmd(projectPath, 'git branch').split('\n')
			.map((branch) => {
				if (branch[0] === '*') {
					currentBranch = branch.substr(2); // trim off the "* " before the current branch
					return currentBranch;
				} else {
					return branch.trim();
				}
			});
		if (!currentBranch) {
			throw new Error('Somehow there is no current branch');
		} else if (currentBranch === userChangesBranch) {
			console.log('already on desired branch');
		} else if (branches.indexOf(userChangesBranch) !== -1) {
			// For now do nothing here. May be able to do something more here at some point...
			console.log('Desired branch exists and is not the current branch');
		} else {
			console.log('Not on current branch, and it doesn\'t exist. Create and use it.');
			commands.push(`git checkout -b ${userChangesBranch}`);
		}
	}

	commands.push('git commit -F .commitmsg');

	const remotes = gitCmd(projectPath, 'git remote');
	if (remotes && remotes.indexOf('origin') !== -1) {
		commands.push(`git push origin ${userChangesBranch}`);
	}

	const stateHandler = window.maestro.state;
	for (const cmd of commands) {
		try {
			console.log(`Running git command on new repository: ${cmd}`);
			const result = gitCmd(projectPath, cmd);

			// since the above git command is blocking, this won't likely show each change. This
			// will be fixed when these are made async.
			stateHandler.setState({
				ViewChangesProgress: stateHandler.state.ViewChangesProgress + '\n\n' + result
			});
			output.push(result);
		} catch (error) {
			fs.unlinkSync(commitMsgFile); // FIXME this should be a temp file not in project repo
			console.error(error);
			return { error, output };
		}
	}

	fs.unlinkSync(commitMsgFile);
	return { output };
};

console.log(`     __  ______    _____________________  ____
    /  |/  /   |  / ____/ ___/_  __/ __ \\/ __ \\
   / /|_/ / /| | / __/  \\__ \\ / / / /_/ / / / /
  / /  / / ___ |/ /___ ___/ // / / _, _/ /_/ /
 /_/  /_/_/  |_/_____//____//_/ /_/ |_|\\____/ v${window.maestro.app.version}`);
