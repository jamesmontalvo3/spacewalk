'use strict';

const nunjucks = require('../../model/nunjucksEnvironment');
const ProcedureWriter = require('./ProcedureWriter');
const IpvXmlTaskWriter = require('../task/IpvXmlTaskWriter');

module.exports = class IpvXmlProcedureWriter extends ProcedureWriter {

	constructor(program, procedure) {
		super(program, procedure);

		// these two are copied from HtmlProcedureWriter
		this.getDocMeta();
		this.content = '';

		this.lastActor = false;
		this.lastLocation = false;
	}

	gitDateToIpvDate(gitDate) {
		const dateObj = new Date(gitDate);
		const localString = dateObj.toLocaleString(
			'en',
			{ month: 'short', year: 'numeric', day: '2-digit' }
		);
		const month = localString.substring(0, 3).toUpperCase();
		const day = localString.substring(4, 6);
		const year = localString.substring(10, 12);
		return `${day} ${month} ${year}`;
	}

	renderIntro() {
		const vars = {};
		for (const key in this.procedure.ipvFields) {
			vars[key] = this.procedure.ipvFields[key];
		}
		vars.name = this.procedure.name.replace('&', '&amp;');
		vars.date = this.gitDateToIpvDate(this.program.getGitDate());

		this.content += nunjucks.render('ipv-xml/procedure-header.xml', vars);
	}

	wrapDocument() {
		return nunjucks.render('ipv-xml/document.xml', {
			title: this.program.fullName,
			content: this.content
			// footer: this.genFooter()
		});
	}

	renderTask(task) {

		const taskWriter = new IpvXmlTaskWriter(
			task,
			this
		);

		// this.content += this.genHeader(task);
		this.content += taskWriter.writeDivisions().join('');
	}

};
