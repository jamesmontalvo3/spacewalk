'use strict';

const docx = require('docx');
const DocxTaskWriter = require('./DocxTaskWriter');

module.exports = class SodfDocxTaskWriter extends DocxTaskWriter {

	/**
	 * Using a ConcurrentStep, write a division.
	 * @param {ConcurrentStep} division    ConcurrentStep object
	 * @return {Array}                     Array of docx.TableRow objects
	 */
	writeDivision(division) {
		const docxTableRows = [];

		const preRows = [];
		let index = 0;

		const notSameActorAndLocation = (actor, location) => {
			return preRows[index].actor !== actor || preRows[index].location !== location;
		};

		for (const actor in division.subscenes) {
			// actor, location, [stepParagraphs]
			const series = this.writeSeries(division.subscenes[actor]);
			for (const stepInfo of series) {

				if (!preRows[index]) { // initiate the first row
					preRows[index] = stepInfo;
				} else if (notSameActorAndLocation(stepInfo.actor, stepInfo.location)) {
					index++;
					preRows[index] = stepInfo; // create new row if actor/location don't match prev
				} else {
					// append step paragraphs to previous if matching actor/location
					preRows[index].stepParagraphs.push(...stepInfo.stepParagraphs);
				}
			}
		}

		for (const row of preRows) {

			const actor = row.actor === this.procedure.lastActor ? '' : row.actor;
			const location = row.location === this.procedure.lastLocation ? '' : row.location;

			docxTableRows.push(this.createRow(actor, location, row.stepParagraphs));

			this.procedure.lastActor = row.actor;
			this.procedure.lastLocation = row.location;
		}

		return docxTableRows;
	}

	/**
	 * Write a table row for an actor+location combination. Anytime actor or location changes a new
	 * row will be created, and only the value that changed will be passed in. So if actor changes
	 * but location stays the same, then location will be an empty string.
	 * @param {string} actor            Actor performing step or empty string
	 * @param {string} location         Location step is performed or empty string
	 * @param {Array} stepParagraphs    Array of docx.Paragraph or similar objects
	 * @return {TableRow}               docx.TableRow object
	 */
	createRow(actor, location, stepParagraphs) {

		const borderValues = {
			style: docx.BorderStyle.NONE,
			size: 0,
			color: 'FFFFFF'
		};
		const borders = {
			top: borderValues,
			bottom: borderValues,
			left: borderValues,
			right: borderValues
		};

		const createCell = (content) => {
			if (typeof content === 'string') {
				content = [new docx.Paragraph({ text: content })]; // wrap in an array of paragraph
			}
			console.log(content);
			return new docx.TableCell({
				children: content,
				verticalAlign: docx.VerticalAlign.TOP,
				borders: borders
			});
		};

		return new docx.TableRow({
			children: [
				createCell(actor),
				createCell(location),
				createCell(stepParagraphs)
			]
		});
	}

	writeSeries(series) {
		const steps = [];
		this.preInsertSteps();
		for (const step of series.steps) {
			const actor = step.context.actors[0];
			const location = step.props.location;
			steps.push({
				actor: actor,
				location: location,
				stepParagraphs: this.insertStep(step)
			});
		}
		this.postInsertSteps();
		return steps;
	}

};
