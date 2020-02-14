'use strict';

const nunjucks = require('../../model/nunjucksEnvironment');
const ProcedureWriter = require('./ProcedureWriter');

module.exports = class HtmlProcedureWriter extends ProcedureWriter {

	constructor(program, procedure) {
		super(program, procedure);

		// Properties handled in CSS
		// initialIndent
		// indentStep
		// hanging
		// levelTypes <----------- maybe
		// levels <--------------- maybe

		this.getDocMeta();
		this.content = '';

	}

	// Handle with CSS
	// getIndents(levelIndex)

	wrapDocument() {
		return nunjucks.render('document.html', {
			title: this.program.fullName,
			content: this.content,
			footer: this.genFooter(),
			css: fs.readFileSync(path.join(__dirname, '../../assets/css/static-eva.css')).toString()
		});
	}

	genHeader(task) {
		return nunjucks.render('task-header.html', {
			procedureName: this.procedure.name,
			taskTitle: task.title,
			duration: this.getTaskDurationDisplay(task)
		});
	}

	genFooter() {
		return nunjucks.render('procedure-footer.html', {
			programName: this.program.fullName,
			programURL: this.program.repoURL,
			procedureName: this.procedure.name,
			gitDate: this.program.getGitDate(),
			gitHash: this.program.getGitHash(),
			gitUncommitted: this.program.getGitUncommittedChanges()
		});
	}

};
