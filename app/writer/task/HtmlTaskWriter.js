'use strict';

const path = require('path');

const getImageFileDimensions = require('image-size');
const nunjucks = require('../../model/nunjucksEnvironment');
const TaskWriter = require('./TaskWriter');
const TextTransform = require('../text-transform/TextTransform');

module.exports = class HtmlTaskWriter extends TaskWriter {

	constructor(task, procedureWriter) {
		super(task, procedureWriter);
		this.textTransform = new TextTransform('html');
		// this.taskNumbering = null;
		// this.getNumbering();
	}

	addImages(images) {

		const imageHtmlArray = [];
		const imagesPath = this.procedureWriter.program.imagesPath;
		const buildPath = this.procedureWriter.program.outputPath;
		for (const imageMeta of images) {

			const imageSrcPath = path.join(imagesPath, imageMeta.path);
			const imageSize = this.scaleImage(
				getImageFileDimensions(imageSrcPath),
				imageMeta
			);

			this.moveImages(imageMeta, buildPath, imagesPath);

			const image = nunjucks.render('image.html', {
				path: path.join('build', imageMeta.path),
				width: imageSize.width, height: imageSize.height
			});

			imageHtmlArray.push(image);
		}

		return imageHtmlArray;
	}

	addBlock(blockType, blockLines) {

		const blockTable = nunjucks.render('block-table.html', {
			blockType: blockType,
			blockLines: blockLines.map((line) => {
				return this.textTransform.transform(line).join('');
			})
		});

		return blockTable;
	}

	/**
	 * ! TBD a description
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

		let actorText = '';
		if (options.actors.length > 0) {
			const actorToColumnIntersect = options.actors.filter((value) => {
				return options.columnKeys.includes(value);
			});
			const isPrimeActor = actorToColumnIntersect.length > 0;

			if (!isPrimeActor) {
				actorText = options.actors[0];
			}
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

				// if there is more than one line, separate them with break
				if (s > 0) {
					texts.push('<br />');
				}

				texts.push(...elem);
			}
		} else {
			throw new Error('addStepText() stepText must be string or array');
		}

		// added class li-level-${options.level} really just as a way to remind that
		// some handling of this will be necessary
		return nunjucks.render('step-text.html', {
			level: options.level,
			actorText,
			stepText: texts.join('')
		});
	}

	addCheckStepText(stepText, level, parent) {
		return nunjucks.render('checkbox-step-text.html', {
			parent,
			stepText: this.textTransform.transform(stepText).join(''),
			level
		});
	}

	addTitleText(title, duration) {
		const subtaskTitle = nunjucks.render('subtask-title.html', {
			title: title.toUpperCase().trim(),
			duration: duration.format('H:M')
		});

		return subtaskTitle;
	}

	preInsertSteps(level) {
		let start;
		if (!level || level === 0) {
			start = `start="${this.stepNumber}"`;
		} else {
			start = '';
		}
		return `<ol ${start}>`;
	}

	postInsertSteps(level) { // eslint-disable-line no-unused-vars
		return '</ol>';
	}

	setModuleOutputType() {
		return 'Html';
	}

};
