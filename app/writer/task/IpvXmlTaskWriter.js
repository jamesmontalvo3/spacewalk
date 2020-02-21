'use strict';

const fs = require('fs');
const path = require('path');

const getImageFileDimensions = require('image-size');
const nunjucks = require('../../model/nunjucksEnvironment');
const TaskWriter = require('./TaskWriter');
const TextTransform = require('../text-transform/TextTransform');

module.exports = class IpvXmlTaskWriter extends TaskWriter {

	constructor(task, procedureWriter) {
		super(task, procedureWriter);
		this.textTransform = new TextTransform('ipvXml');
		// this.taskNumbering = null;
		// this.getNumbering();
	}

	// FROM SODFDOCX task wirter

	/**
	 * Using a ConcurrentStep, write a division.
	 * @param {ConcurrentStep} division    ConcurrentStep object
	 * @return {Array}                     Array of docx.TableRow objects
	 */
	writeDivision(division) {
		const tableRows = [];

		const preRows = [];
		let index = 0;

		const notSameActorAndLocation = (actor, location) => {
			return preRows[index].actor !== actor || preRows[index].location !== location;
		};

		if (Object.keys(division.subscenes).length > 1) {
			// throw new Error('Sodf does not currently support multiple actors in a division');
		}

		for (const actor in division.subscenes) {

			const seriesModel = division.subscenes[actor];

			// returns array of step XML
			const seriesDisplay = this.writeSeries(seriesModel);

			for (const stepInfo of seriesDisplay) {

				if (!preRows[index]) { // initiate the first row
					preRows[index] = stepInfo;
				} else if (notSameActorAndLocation(stepInfo.actor, stepInfo.location)) {
					index++;
					preRows[index] = stepInfo; // create new row if actor/loc don't match prev
				} else {
					// append step contents to previous step contents if matching actor/location
					preRows[index].stepContents.push(...stepInfo.stepContents);
				}
			}
		}

		for (const row of preRows) {

			const actor = row.actor === this.procedure.lastActor ? '' : row.actor;
			const location = row.location === this.procedure.lastLocation ? '' : row.location;

			tableRows.push(this.createRow(actor, location, row));

			this.procedure.lastActor = row.actor;
			this.procedure.lastLocation = row.location;
		}

		return tableRows;
	}

	/**
	 * Write a table row for an actor+location combination. Anytime actor or location changes a new
	 * row will be created, and only the value that changed will be passed in. So if actor changes
	 * but location stays the same, then location will be an empty string.
	 * @param {string} actor            Actor performing step or empty string
	 * @param {string} location         Location step is performed or empty string
	 * @param {Object} row              Object like {
	 *                                      stepNumber: 23,
	 *                                      actor: 'IV',
	 *                                      location: '',
	 *                                      stepContent: [...]
	 *                                  }
	 * @return {string}                 HTML output of row
	 */
	createRow(actor, location, row) {
		return row.stepContents.join('');
	}

	writeSeries(seriesModel, columnKeys) {
		let previousActor = '';
		let previousLocation = '';
		const steps = [];
		for (const step of seriesModel.steps) {
			let actor = '';
			let location = '';
			step.columnKeys = Array.isArray(columnKeys) ? columnKeys : [columnKeys];

			const checkActor = step.getActors()[0];
			if (checkActor !== previousActor) {
				actor = checkActor;
				previousActor = actor;
				// console.log('found new actor');
			} else {
				// console.log('same actor as before');
				actor = '';
			}
			if (step.location !== previousLocation) {
				location = step.getLocation();
				previousLocation = location;
			} else {
				location = '';
			}

			steps.push({
				stepNumber: this.stepNumber,
				actor: actor,
				location: location,
				stepContents: this.insertStep(step)
			});
		}
		return steps;
	}

	addImages(images) {
		const imageXmlArray = [];
		const imagesPath = path.join(this.procedureWriter.program.imagesPath);
		const ipvXmlFolder = [this.procedure.number, this.procedure.uniqueId].join('_');
		const imagesFolder = [ipvXmlFolder, 'files'].join('_');
		const ipvXmlFolderBuild = path.join(this.procedureWriter.program.outputPath, ipvXmlFolder);
		const buildPath = path.join(ipvXmlFolderBuild, imagesFolder);

		// if image folder doesn't exist then make one

		if (!fs.existsSync(ipvXmlFolderBuild)) {
			fs.mkdirSync(ipvXmlFolderBuild);
		}
		if (!fs.existsSync(buildPath)) {
			fs.mkdirSync(buildPath);
		}

		for (const imageMeta of images) {

			const imageSrcPath = path.join(imagesPath, imageMeta.path);
			const imageText = imageMeta.text;
			const imageSize = this.scaleImage(
				getImageFileDimensions(imageSrcPath),
				imageMeta
			);

			this.moveImages(imageMeta, buildPath, imagesPath);

			const image = nunjucks.render('ipv-xml/image.xml', {
				path: path.join(imagesFolder, imageMeta.path),
				width: imageSize.width,
				height: imageSize.height,
				imageCaption: imageText
				// todo add fields for image number, and caption
			});

			imageXmlArray.push(image);
		}

		return imageXmlArray;
	}

	addBlock(blockType, blockLines) {

		const blockTable = nunjucks.render('ipv-xml/block-table.xml', {
			blockType: blockType,
			blockLines: blockLines.map((line) => {
				return this.textTransform.transform(line).join('');
			})
		});

		return blockTable;
	}

	/**
	 * Creates text string for step
	 * @param {*} stepText        Text to turn into a step
	 * @param {*} options         options = { level: 0, actors: [], columnKey: "" }
	 * @return {string}
	 */
	addStepText(stepText, options = {}) {
		if (!options.level) {
			options.level = 0;
		}
		if (!options.actors) {
			options.actors = [];
		}
		if (!options.columnKeys) {
			options.columnKeys = [];
		}

		const texts = [];
		if (typeof stepText === 'string') {
			texts.push(...this.textTransform.transform(stepText));
		} else if (Array.isArray(stepText)) {
			for (let s = 0; s < stepText.length; s++) {
				let elem = stepText[s];
				if (typeof elem === 'string') {
					elem = this.textTransform.transform(elem);
				} else if (!Array.isArray(elem)) {
					throw new Error('Expect string or array');
				}
				texts.push(...elem);
			}
		} else {
			throw new Error('addStepText() stepText must be string or array');
		}

		return nunjucks.render('ipv-xml/step-text.xml', {
			level: options.level,
			actorText: options.actor,
			stepText: texts.join('')
		});
	}

	// addCheckStepText(stepText, level, parent) {
	// return nunjucks.render('ipv-xml/checkbox-step-text.xml', {
	// parent,
	// level
	// });
	// }

	addTitleText(title) {
		const subtaskTitle = nunjucks.render('ipv-xml/subtask-title.xml', {
			title: this.textTransform.transform(title.toUpperCase().trim()).join('')
		});

		return subtaskTitle;
	}

	preInsertSteps() {
		// let start;
		// if (!level || level === 0) {
		// start = `start="${this.stepNumber}"`;
		// } else {
		// start = '';
		// }
		// return `<ol ${start}>`;
	}

	postInsertSteps(level) { // eslint-disable-line no-unused-vars
		// return '</ol>';
	}

	setModuleOutputType() {
		return 'Html';
	}

};
