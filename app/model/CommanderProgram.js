'use strict';

const path = require('path');
const fs = require('fs');

const commander = require('commander');

const Program = require('./Program');
const Procedure = require('./Procedure');
const EvaDocxProcedureWriter = require('../writer/procedure/EvaDocxProcedureWriter');
const SodfDocxProcedureWriter = require('../writer/procedure/SodfDocxProcedureWriter');
const IpvXmlProcedureWriter = require('../writer/procedure/IpvXmlProcedureWriter');
const EvaHtmlProcedureWriter = require('../writer/procedure/EvaHtmlProcedureWriter');

const Server = require('../web/Server');

function handleProjectPath(projectPath) {
	if (projectPath) {
		return path.resolve(projectPath);
	}
	return process.cwd();
}

function pathMustExist(path, createIfMissing = false) {
	try {
		fs.statSync(path);
	} catch (e) {
		if (createIfMissing) {
			fs.mkdirSync(path); // catch here, too?
		} else {
			console.error(`Path ${path} does not exist`);
			process.exit();
		}
	}
	return true;
}

/**
 * Tests whether the specified path can be written to by this process
 *
 * @param   {string} pathToTest The path to test
 * @return  {boolean} True if path can be written to, false otherwise
 */
function canWrite(pathToTest) {

	//  Check whether the path exists
	if (!fs.existsSync(pathToTest)) {
		//  File doesn't exist - check permissions for the parent dir
		const p = path.parse(pathToTest);
		let dir = p.dir;

		if (dir === '') {
			dir = '.';
		}

		pathToTest = dir;
	}

	//  Test permissions
	try {
		fs.accessSync(pathToTest, fs.constants.W_OK);
		//  Yes
		return true;
	} catch (err) {
		//  No
		return false;
	}
}

module.exports = class CommanderProgram extends Program {

	constructor() {
		super();
		this.commander = commander;
		this.commander
			.version(this.version, '--version')
			.name(this.name)
			.description(this.description);

		this.composeOutputTypes = [
			{ option: 'eva-docx', desc: 'Generate EVA .docx file', prop: 'evaDocx' },
			{ option: 'html', desc: 'Generate HTML file', prop: 'html' },
			{ option: 'sodf-docx', desc: 'Generate SODF-like .docx file', prop: 'sodfDocx' },
			{ option: 'ipv-xml', desc: 'Generate IPV compatible XML output', prop: 'ipvXml' }
		];

	}

	/**
	 * This function configures commander.js for this application's command line
	 * arguments, and attempts to parse the arguments passed to this process.
	 */
	buildProgramArguments() {

		const compose = this.commander
			.command('compose [projectPath]')
			.description('Build products for a Maestro project')
			.option(
				'--all',
				`Build all output types: ${this.composeOutputTypes.map((a) => a.option).join(', ')}`,
				null
			);

		for (const ot of this.composeOutputTypes) {
			compose.option(`--${ot.option}`, ot.desc, null);
		}

		compose.action((projectPath, options) => {
			this.prepComposeArguments(projectPath, options);
			this.validateProgramArguments();
			this.doCompose();
		});

		this.commander
			.command('conduct [projectPath]')
			.description('Serve Maestro web app')
			.option('-p, --port <num>', 'specify port on which to serve', 8000)
			.action((projectPath, options) => {
				this.serveMaestroWeb(projectPath, options);
			});

	}

	prepComposeArguments(projectPath, options) {
		this.projectPath = handleProjectPath(projectPath);

		let anyTrue = false;

		for (const ot of this.composeOutputTypes) {
			// map options inputs to program properties
			if (options.all || options[ot.prop]) {
				this[ot.prop] = true;
				anyTrue = true;
			} else {
				this[ot.prop] = false;
			}
		}

		if (!anyTrue) {
			this.evaDocx = true; // default if nothing is selected
		}
	}

	/**
	 * Process user input
	 * @param {Array} args  Command line argument array (e.g. process.argv)
	 */
	process(args) {
		try {
			this.commander.parse(args);
		} catch (e) {
			if (e instanceof TypeError) {
				//  Commander.js will annoyingly throw a TypeError if an argument
				//  that requires a parameter is missing its parameter.
				this.commander.help();
				console.log('\n');
				console.error(e);
			} else {
				throw e;
			}
		}
	}

	/**
	 * Validates the arguments...
	 *
	 */
	validateProgramArguments() {

		this.procedurePath = path.join(this.projectPath, 'procedures');
		this.tasksPath = path.join(this.projectPath, 'tasks');
		this.imagesPath = path.join(this.projectPath, 'images');
		this.outputPath = path.join(this.projectPath, 'build');
		this.gitPath = path.join(this.projectPath, '.git');

		pathMustExist(this.procedurePath);
		pathMustExist(this.tasksPath);

		// at this point tasks and procedures paths exist. Reasonably certain this
		// is an xOPS project. Allow forcing creation of outputPath with `true`.
		pathMustExist(this.outputPath, true);

		//  If this process can't write to the output location, emit an error and quit
		if (!canWrite(this.outputPath)) {
			console.error(`Can't write to output location: ${this.outputPath}`);
			process.exit();
		}

	}

	doCompose() {
		fs.readdir(this.procedurePath, (err, files) => {
			if (err) {
				console.log(`Unable to scan procedures directory: ${err}`);
				process.exit();
			}
			for (const file of files) {
				this.generateProcedureFormats(file);
			}
		});
	}

	generateProcedureFormats(file) {

		console.log(`Generating procedure from ${file}`);

		const procedureFile = path.join(this.procedurePath, file);

		// Parse the input file
		const procedure = new Procedure();
		const err = procedure.addProcedureDefinitionFromFile(procedureFile);
		if (err) {
			procedure.handleParsingError(err, file);
		}

		if (this.evaDocx) {
			console.log('Creating EVA format');
			const eva = new EvaDocxProcedureWriter(this, procedure);

			eva.renderIntro(() => {
				eva.renderTasks();
				eva.writeFile(path.join(
					this.outputPath,
					`${procedure.filename}.docx`
				));
			});
		}

		if (this.sodfDocx) {
			this.renderBasicFormat(procedure, SodfDocxProcedureWriter, 'SODF DOCX', 'sodf.docx');
		}

		if (this.ipvXml) {
			this.renderBasicFormat(procedure, IpvXmlProcedureWriter, 'IPV XML', 'xml');
		}

		if (this.html) {
			this.renderBasicFormat(procedure, EvaHtmlProcedureWriter, 'EVA HTML', 'eva.html');
		}

	}

	renderBasicFormat(procedure, WriterClass, formatName, extension) {
		console.log(`Creating ${formatName} format`);
		const writer = new WriterClass(this, procedure);
		writer.renderIntro();
		writer.renderTasks();

		let writeFileLocation = '';
		if (formatName === 'IPV XML') {
			writeFileLocation = path.join(
				this.outputPath,
				[procedure.number, procedure.uniqueId].join('_'),
				`${procedure.filename}.${extension}`
			);
		} else {
			writeFileLocation = path.join(
				this.outputPath,
				`${procedure.filename}.${extension}`
			);
		}
		writer.writeFile(writeFileLocation);
	}

	serveMaestroWeb(projectPath, options) {
		this.projectPath = handleProjectPath(projectPath);
		this.validateProgramArguments();

		const server = new Server(this);
		server
			.setPort(options.port)
			.setupStatic()
			.serve();
	}
};
