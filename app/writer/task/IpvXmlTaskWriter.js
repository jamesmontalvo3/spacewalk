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

	// ! FIXME delete this if not used below
	groupStepsByActorAndLocation(division) {

		const rows = [];
		let index = 0;

		// FIXME this should have row and stepInfo as params
		const notSameActorAndLocation = (actor, location) => {
			return rows[index].actor !== actor || rows[index].location !== location;
		};

		for (const actor in division.subscenes) {

			const seriesModel = division.subscenes[actor];

			// returns array of step XML
			const seriesDisplay = this.writeSeries(seriesModel);

			for (const stepInfo of seriesDisplay) {

				if (!rows[index]) { // initiate the first row
					rows[index] = stepInfo;
				} else if (notSameActorAndLocation(stepInfo.actor, stepInfo.location)) {
					index++;
					rows[index] = stepInfo; // create new row if actor/loc don't match prev
				} else {
					// append step contents to previous step contents if matching actor/location
					rows[index].stepContents.push(...stepInfo.stepContents);
				}
			}
		}

		return rows;
	}

	/**
	 * As of this writing, this is the only TaskWriter that overrides the base writeDivisions()
	 *
	 * @return {Array} - Array of XML strings representing all divisions (so content of whole
	 *                   activity)
	 */
	writeDivisions() {

		const divisions = this.task.concurrentSteps;
		const allActivitySteps = [];

		for (const division of divisions) {
			allActivitySteps.push(
				...this.writeDivision(division)
			);
		}

		// ! todo FIXME
		// @Kris if you need to do anything with determining previous actors and locations, in order
		// to figure out whether to display actor/location for each step, do so here.
		// Possibly use groupStepsByActorAndLocation() above.

		// for now just throw out step model info and keep xml
		const view = allActivitySteps.map(
			({ /* stepModel, */ stepView }) => {
				return stepView;
			}
		);

		return view;
	}

	/**
	 * Using a ConcurrentStep, write a division.
	 * @param {ConcurrentStep} division    ConcurrentStep object
	 * @return {Array}                     Array of docx.TableRow objects
	 */
	writeDivision(division) {

		if (Object.keys(division.subscenes).length > 1) {
			// throw new Error('Sodf does not currently support multiple actors in a division');
			console.error('IPV does not currently support multiple actors in a division');
		}

		const divisionView = [];

		for (const seriesKey in division.subscenes) {
			const seriesModel = division.subscenes[seriesKey];
			divisionView.push(
				// writeSeries returns array of [{stepModel, stepView}]
				// writeDivision should return bigger version of array (concatenating all series')
				// todo - this may stop being true if IPV comes up with way to handle parallelism,
				// todo   or Maestro comes up with a way to emulate parallelism in IPV
				...this.writeSeries(seriesModel)
			);
		}

		return divisionView;
	}

	writeSeries(seriesModel, columnKeys) {
		const steps = [];
		for (const stepModel of seriesModel.steps) {
			stepModel.columnKeys = Array.isArray(columnKeys) ? columnKeys : [columnKeys];

			steps.push({
				stepModel: stepModel,
				stepView: this.insertStep(stepModel)
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
	 * @param {Step} stepModel    Step object
	 * @return {string}
	 */
	addStepText(stepText, options = {}, stepModel) {
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

		const numberedProps = ['title', 'text'];
		// const stepNumber = stepModel.isSubstep() ? stepModel.getSubstepNumbers(numberedProps) :
		// stepModel.getActivityStepNumber(numberedProps);
		let stepNumber;
		if (stepModel.isSubstep()) {
			const stepNumComponents = [
				stepModel.getRootStep().getActivityStepNumber(numberedProps)
			];
			stepNumComponents.push(...stepModel.getSubstepNumbers(numberedProps));
			stepNumber = stepNumComponents.join('.');
		} else {
			stepNumber = stepModel.getActivityStepNumber(numberedProps);
		}

		return nunjucks.render('ipv-xml/step-text.xml', {
			level: options.level,
			actorText: options.actor,
			stepText: texts.join(''),
			stepNumber: stepNumber
		});
	}

	// addCheckStepText(stepText, level, parent) {
	// return nunjucks.render('ipv-xml/checkbox-step-text.xml', {
	// parent,
	// level
	// });
	// }

	addTitleText(title, duration, stepModel) {
		const subtaskTitle = nunjucks.render('ipv-xml/subtask-title.xml', {
			title: this.textTransform.transform(title.toUpperCase().trim()).join(''),
			stepNumber: stepModel.getActivityStepNumber(['title', 'text'])
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
