'use strict';

const fs = require('fs');
const path = require('path');
const docx = require('docx');
const getImageFileDimensions = require('image-size');
const arrayHelper = require('../../helpers/arrayHelper');
const typeHelper = require('../../helpers/typeHelper');

const TaskWriter = require('./TaskWriter');
const TextTransform = require('../text-transform/TextTransform');

module.exports = class DocxTaskWriter extends TaskWriter {

	/**
	 * @param {Task} task
	 * @param {DocxProcedureWriter} procedureWriter
	 */
	constructor(task, procedureWriter) {
		super(task, procedureWriter);

		this.taskNumbering = null;
		this.getNumbering();
		this.textTransform = new TextTransform('docx', task);

		this.checkboxNumbering = {
			numbering: null,
			currentLevel: -1
		};
	}

	addImages(images) {

		const paragraphs = [];

		const imagesPath = this.procedureWriter.program.imagesPath;
		for (const imageMeta of images) {

			const imagePath = path.join(imagesPath, imageMeta.path);
			const imageSize = this.scaleImage(
				getImageFileDimensions(imagePath),
				imageMeta
			);

			const image = docx.Media.addImage(
				this.doc,
				fs.readFileSync(imagePath),
				imageSize.width,
				imageSize.height
			);

			paragraphs.push(new docx.Paragraph({
				children: [image],
				alignment: docx.AlignmentType.CENTER
			}));
		}

		return paragraphs;
	}

	addParagraph(params = {}) {
		if (!params.text) {
			params.text = '';
		}
		if (!params.style) {
			params.style = 'normal';
		}

		return new docx.Paragraph(params);
	}

	addBlock(blockType, blockLines) {
		const numbering = this.taskNumbering;

		const fillColors = {
			comment: '008000',
			note: 'FFFFFF',
			caution: 'FFFF00',
			warning: 'FF0000'
		};

		const textColors = {
			comment: 'FFFFFF',
			note: '000000',
			caution: '000000',
			warning: 'FFFFFF'
		};

		const lines = [];
		for (const line of blockLines) {
			lines.push(new docx.Paragraph({
				children: this.textTransform.transform(line),
				numbering: {
					num: numbering.concrete,
					level: 0
				}
			}));
		}

		return new docx.Table({
			rows: [
				new docx.TableRow({
					children: [new docx.TableCell({
						children: [new docx.Paragraph({
							children: [new docx.TextRun({
								text: blockType.toUpperCase(),
								color: textColors[blockType]
							})],
							alignment: docx.AlignmentType.CENTER
						})],
						shading: {
							fill: fillColors[blockType],
							val: docx.ShadingType.CLEAR,
							color: 'auto'
						}
					})]
				}),
				new docx.TableRow({
					children: [new docx.TableCell({
						children: lines
					})]
				})
			]
			// todo blocks are currently sort of ugly
			// todo   - forcing 100% would be good if possible
			// todo   - adding some margin so they blocks don't run into each other and the side of
			// todo     the task table would also be good.
			// todo   - columnWidths, float, and layout are probably useless in this context
			// width: ?
			// columnWidths: ?
			// margins: { marginUnitType: ?, top: ?, bottom: ?, right: ?, left: ? }
			// float: ?
			// layout: ?
		});

	}

	getNumbering() {
		this.taskNumbering = {};

		this.taskNumbering.abstract = this.doc.Numbering.createAbstractNumbering();

		for (let i = 0; i < 3; i++) {
			const indents = this.procedureWriter.getIndents(i);
			const text = `%${i + 1}.`;
			const level = this.taskNumbering.abstract.createLevel(
				i,
				this.procedureWriter.levelTypes[i],
				text,
				'left'
			);
			level.indent({ left: indents.left, hanging: indents.hanging });
			level.leftTabStop(indents.tab);
		}

		this.taskNumbering.concrete = this.doc.Numbering.createConcreteNumbering(
			this.taskNumbering.abstract
		);
	}

	/**
	 * Format inputs for docx.Numbering. Several inputs can be a scalar, array, or function, and in
	 * order to operate on a common datatype they're all converted to an array, as follows:
	 *
	 * If a scalar: Fill an array of length `depth` with the scalar as each element
	 * If an array: Return the array unchanged. If it's too short, repeat it to length `depth`
	 * If a function: Use the function to build an array of length `depth`
	 *
	 * @param  {string|boolean|number|Array|Function} scalarArrayOrFn  Input used to generate the
	 *                                                elements of the returned array
	 * @param  {integer} depth  How many elements to put in the returned array
	 * @return {Array}          The returned array
	 */
	formatNumberingInput(scalarArrayOrFn, depth) {

		const type = typeHelper.is(scalarArrayOrFn, 'scalar', 'array', 'function');
		const formatFunctions = {
			scalar: (v) => {
				return Array(depth).fill(v); // fill an array with the string/number/boolean/etc
			},
			array: (v) => {
				return arrayHelper.repeatArray(v, depth); // repeat the array to length 'depth'
			},
			function: (v) => {
				return Array(depth).fill(0).map((cur, index) => {
					return v(index);
				});
			}
		};
		return formatFunctions[type](scalarArrayOrFn);
	}

	/**
	 * Create concrete numbering instance
	 * @param  {Object} options Options for the list (aka the "numbering")
	 *         Example:
	 *           options = {
	 *             depth: how many sub-lists to create
	 *             indents: FUNCTION giving the indents based upon level of sub-listing
	 *             levelTypes: SCALAR, ARRAY or FUNCTION defining what type of list to create, e.g.
	 *                         decimal, lowerLetter, lowerRoman, upperLetter, upperRoman
	 *             text: SCALAR, ARRAY, or FUNCTION defining what text to used for list item prefix.
	 *                   To setup an outline format, text like %1.%2.%3 would generate numbering
	 *                   like 1.1.1, 1.1.2, 1.1.3
	 *             font: SCALAR, ARRAY, or FUNCTION defining font to use for the list item prefix.
	 *                   Only works if docx.RunFonts is available (not yet in 5.0.0-rc6) Ref #49
	 *           }
	 * @return {Object}         docx concrete numbering instance
	 */
	createGenericNumbering(options = {}) {
		const defaults = {
			depth: 5,
			// indents: this.procedureWriter.getIndents,
			levelTypes: (i) => {
				if (i % 2 === 0) {
					return 'decimal';
				} else {
					return 'lowerLetter';
				}
			},
			text: (i) => {
				return `%${i + 1}.`;
			},
			font: false
		};

		for (const key in defaults) {
			if (!options[key]) {
				options[key] = defaults[key];
			}
		}

		if (options.depth > 9) {
			throw new Error('Numbering depth cannot be greater than 9');
		}

		options.levelTypes = this.formatNumberingInput(options.levelTypes, options.depth);
		options.text = this.formatNumberingInput(options.text, options.depth);
		options.font = this.formatNumberingInput(options.font, options.depth);

		if (!this.genericNumbering) {
			this.genericNumbering = { abstract: [], concrete: [] };
		}

		const abstract = this.doc.Numbering.createAbstractNumbering();

		for (let i = 0; i < options.depth; i++) {
			const indents = this.procedureWriter.getIndents(i);
			const level = abstract.createLevel(
				i,
				options.levelTypes[i],
				options.text[i],
				'left'
			);
			level.indent({ left: indents.left, hanging: indents.hanging });
			level.leftTabStop(indents.tab);

			// Clean this up when iss #49 fixed
			if (options.font[i] && docx.RunFonts) {
				level.addRunProperty(new docx.RunFonts(options.font[i]));
			}
		}
		const concrete = this.doc.Numbering.createConcreteNumbering(abstract);

		this.genericNumbering.abstract.push(abstract);
		this.genericNumbering.concrete.push(concrete);

		return concrete;
	}

	getCheckboxNumbering() {
		return {
			num: this.checkboxNumbering.numbering,
			level: this.checkboxNumbering.currentLevel + 1
		};
	}

	getTaskNumbering(level) {
		return {
			num: this.taskNumbering.concrete,
			level: level
		};
	}

	alterStepParagraphOptions(paraOptions /* , stepOptions */) {
		return paraOptions;
	}

	/**
	 * ! TBD a description
	 * @param {*} stepText        Text to add as a step
	 * @param {*} options         options = { level: 0, actors: [], columnKey: "" }
	 * @return {docx.Paragraph}   DOCX paragraph object
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
		let paraOptions = {
			numbering: this.getTaskNumbering(options.level),
			children: []
		};

		paraOptions = this.alterStepParagraphOptions(paraOptions, options);

		if (typeof stepText === 'string') {
			paraOptions.children.push(...this.textTransform.transform(stepText));
		} else if (Array.isArray(stepText)) {
			for (let s = 0; s < stepText.length; s++) {
				let elem = stepText[s];
				if (typeof elem === 'string') {
					elem = this.textTransform.transform(elem);
				} else if (!Array.isArray(elem)) {
					// elem is a TextRun object
					elem = [elem];
				}

				// if there is more than one line of step text, make all but the first have a line
				// break in front
				if (s > 0) {
					elem[0].break();
				}
				paraOptions.children.push(...elem);
			}
		} else {
			throw new Error('addStepText() stepText must be string or array');
		}

		return this.addParagraph(paraOptions);
	}

	addCheckStepText(stepText /* , level */) {

		const paraOptions = {
			children: [],
			numbering: this.getCheckboxNumbering()
		};

		// Clean this up when iss #49 fixed
		if (!docx.RunFonts) {
			paraOptions.children.push(new docx.TextRun({
				text: 'q', // in Wingdings this is an empty checkbox
				font: {
					name: 'Wingdings'
				}
			}));
			stepText = ` ${stepText}`; // add a space between checkbox and text
		}

		paraOptions.children.push(...this.textTransform.transform(stepText));

		return this.addParagraph(paraOptions);
	}

	addTitleText(title, duration) {
		return this.addParagraph({
			children: [
				new docx.TextRun({
					text: title.toUpperCase().trim(),
					underline: {
						type: 'single'
					}
				}),
				new docx.TextRun({
					text: ` (${duration.format('H:M')})`
				})
			]
		});
	}

	preInsertSteps(level, isCheckbox) {
		if (isCheckbox) {
			// this.checkboxNumbering.currentLevel === -1 ||
			if (!this.checkboxNumbering.numbering) {

				let options = {};

				// Clean this up when iss #49 fixed
				if (docx.RunFonts) {
					options = {
						text: 'q',
						font: 'Wingdings'
					};
				}
				this.checkboxNumbering.numbering = this.createGenericNumbering(options);
			}
			this.checkboxNumbering.currentLevel++;
		}
		return false;
	}

	postInsertSteps(level, isCheckbox) {
		if (isCheckbox) {
			this.checkboxNumbering.currentLevel--;
			if (this.checkboxNumbering.currentLevel === -1) {
				// unset this numbering if the list is over
				// this.checkboxNumbering.numbering = null;
			}
		}
		return false;
	}

	setModuleOutputType() {
		return 'Docx';
	}
};
