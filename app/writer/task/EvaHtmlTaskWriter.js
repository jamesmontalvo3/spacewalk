'use strict';

const nunjucks = require('../../model/nunjucksEnvironment');
const HtmlTaskWriter = require('./HtmlTaskWriter');
const EvaDivisionWriter = require('./EvaDivisionWriter');
const jsonHelper = require('../../helpers/jsonHelper');
module.exports = class EvaHtmlTaskWriter extends HtmlTaskWriter {

	constructor(task, procedureWriter) {
		super(task, procedureWriter);

		this.taskColumns = task.getColumns();

		this.numCols = this.taskColumns.length;
		this.numContentRows = task.concurrentSteps.length;
		this.numRows = this.numContentRows + 1;

		// this.divisionIndex = 0;

		// this.tableContents = '';
	}

	setTaskTableHeader() {

		const columnKeys = this.task.getColumns();
		const columnNames = [];

		if (columnKeys.length !== this.numCols) {
			throw new Error('header column text array does not match number of table columns');
		}

		for (let c = 0; c < this.numCols; c++) {
			columnNames.push(this.procedure.ColumnsHandler.getDisplayTextFromColumnKey(
				columnKeys[c]
			));
		}

		const tableHeaderHtml = nunjucks.render(
			'eva-task-table-header.html',
			{
				columnNames: columnNames,
				columnWidthPercent: (100 / this.numCols)
			}
		);

		// this.divisionIndex++;
		return tableHeaderHtml;
	}

	writeDivision(division) {
		const divWriter = new EvaDivisionWriter();

		const columns = divWriter.prepareDivision(
			division, this
		);

		const columnSettings = [];

		for (const c in columns) {
			columnSettings.push({
				content: columns[c].children.join(''),
				colspan: columns[c].colspan
			});
		}

		const tableDivision = nunjucks.render(
			'eva-table-division.html',
			{
				division: columnSettings
			}
		);

		this.divisionIndex++;
		return [tableDivision];
	}

	writeSeries(series, columnKeys) {
		const steps = [];
		const preStep = this.preInsertSteps();
		if (preStep) {
			steps.push(preStep);
		}
		for (const step of series.steps) {
			step.props.columnKeys = Array.isArray(columnKeys) ? columnKeys : [columnKeys];
			steps.push(
				...this.insertStep(step)
			);
		}
		const postStep = this.postInsertSteps();
		if (postStep) {
			steps.push(postStep);
		}
		return steps;
	}

	/**
	 * Write a Task model into the resulting HTML doc
	 * @param {Task} task
	 * @return {string}
	 */
	embedTask(task) {
		return nunjucks.render(
			'embedded-task.html',
			{ task: jsonHelper.stringifyNoDuplicates(task, true) }
		);
	}
};
