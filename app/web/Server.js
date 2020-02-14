'use strict';

const path = require('path');
const fs = require('fs');

const express = require('express');
const nunjucks = require('../model/nunjucksEnvironment');

const consoleHelper = require('../helpers/consoleHelper');

module.exports = class Server {

	constructor(program) {

		this.program = program;
		this.procedureFiles = program.getProjectProcedureFiles();

		this.app = express();
		this.port = 8000;

		this.staticResources = [
			// Serve project resources
			{ webPath: 'images', localBase: program.projectPath, localRelative: 'images' },
			{ webPath: 'procedures', localBase: program.projectPath, localRelative: 'procedures' },
			{ webPath: 'tasks', localBase: program.projectPath, localRelative: 'tasks' },

			// Serve application resources
			{ webPath: 'maestro', localBase: __dirname, localRelative: '../../build' },
			{ webPath: 'maestro-assets', localBase: __dirname, localRelative: '../assets' },
			{
				webPath: 'maestro-views',
				localBase: __dirname,
				localRelative: '../writer/nunjucks-templates'
			}
		];

		this.app.use(express.json());
	}

	setPort(newPort) {
		newPort = parseInt(newPort);
		if (!newPort || newPort < 1025) {
			const tooSmall = newPort < 1025 ?
				'\n  Please pick an integer over 1024' :
				'';
			const recommend = '\n  Recommended options: 3000, 8000, 8080, 9000';
			consoleHelper.error(`port ${newPort} is invalid.${tooSmall}${recommend}`);
		}
		this.port = newPort;
		return this;
	}

	setupStatic() {
		for (const resource of this.staticResources) {
			this.app.use(
				`/${resource.webPath}`,
				express.static(path.join(
					resource.localBase,
					resource.localRelative
				))
			);
		}
		return this;
	}

	validateFileRequest(req, filenameParam = 'filename') {

		if (['tasks', 'procedures'].indexOf(req.params.filetype) === -1) {
			throw new Error('file type editing can only be performed on tasks and procedures');
		}

		if (req.params[filenameParam].indexOf('..') !== -1) {
			throw new Error('file names cannot move up a directory by including ..');
		}

		return path.join(
			this.program.projectPath,
			req.params.filetype,
			req.params[filenameParam]
		);
	}

	handleFileUpdates = (req, res) => {

		const filepath = this.validateFileRequest(req);

		console.log(`saving new content to ${filepath}`);
		// console.log(req.body);

		fs.writeFile(filepath, req.body.yaml, (err) => {
			if (err) {
				console.log(err);
				res.send({ success: false, msg: `error writing file ${filepath}` });
			} else {
				res.send({ success: true, msg: `file ${filepath} written` });
			}
		});
	}

	handleCheckFileExists = (req, res) => {

		const filepath = this.validateFileRequest(req);

		console.log(`checking if file path exists: ${filepath}`);

		fs.exists(filepath, function(exists) {
			if (exists) {
				res.send({ exists: true });
			} else {
				res.send({ exists: false });
			}
		});

	}

	handleMoveFile = (req, res) => {

		const filepath = this.validateFileRequest(req);
		const newfilepath = this.validateFileRequest(req, 'newfilename');

		const resultHandler = function(result) {
			console.log(result);
			res.send(result);
		};

		this.program.moveFile(
			filepath,
			newfilepath,
			resultHandler,
			resultHandler // same action on error
		);
	}

	serve() {
		this.app.get('/', (req, res) => {
			res.send(nunjucks.render('maestro-conduct.html', {
				title: 'Maestro',
				procedureFiles: this.procedureFiles
			}));
		});

		this.app.post('/edit/:filetype/:filename', this.handleFileUpdates);
		this.app.post('/exists/:filetype/:filename', this.handleCheckFileExists);
		this.app.post('/move/:filetype/:filename/:newfilename', this.handleMoveFile);

		this.app.listen(this.port, () => {
			consoleHelper.success(
				`Visit http://localhost:${this.port} in your web browser. Type ctrl-c here to exit`
			);
		});
	}
};
