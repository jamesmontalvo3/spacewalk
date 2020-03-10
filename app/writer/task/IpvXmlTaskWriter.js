'use strict';

const fs = require('fs');
const path = require('path');

const getImageFileDimensions = require('image-size');
const nunjucks = require('../../model/nunjucksEnvironment');
// const convertHTMLToPDF = require('pdf-puppeteer');
const TaskWriter = require('./TaskWriter');
const TextTransform = require('../text-transform/TextTransform');

var pdf = require('html-pdf');

module.exports = class IpvXmlTaskWriter extends TaskWriter {

	constructor(task, procedureWriter) {
		super(task, procedureWriter);
		this.textTransform = new TextTransform('ipvXml', task);
		// this.taskNumbering = null;
		// this.getNumbering();
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

	/**
	 * <Step>
	 *   <StepTitle>
	 *     <StepNumber>1.1.1.1</StepNumber>  <-- Required
	 *     <Text>TITLE TEXT</Text>           <-- Use this for an underlined title
	 *
	 *     <Instruction>                     <-- Use something like this for regular text
	 *       <ClearText>
	 *         <Text>Some text</Text>
	 *       </ClearText>
	 *     </Instruction>
	 *   </StepTitle>
	 *
	 *   Everything else
	 * </Step>
	 *
	 *
	 * @param {Object} elements
	 * @param {Step} stepModel
	 * @return {Array}
	 */
	combineInsertStepElements(elements, stepModel) {

		let texts = elements.body;
		let lesserTitle = '';

		if (!elements.title || !elements.title.length) {
			lesserTitle = texts.shift();
			lesserTitle = `<Instruction><ClearText><Text>${lesserTitle}</Text></ClearText></Instruction>`;
		}

		texts = nunjucks.render('ipv-xml/step-text.xml', { texts });

		return [
			'<StepTitle>',
			this.formatStepNumber(stepModel),
			this.getActorAndLocationDisplay(stepModel),
			...elements.title,
			lesserTitle,
			'</StepTitle>',

			texts,

			...elements.images,
			...elements.prebody,
			// in none-IPV, title and body go here
			...elements.postbody,
			...elements.checkboxes,
			...elements.grandChildren
		];
	}

	getActorAndLocationDisplay(stepModel) {

		const actor = stepModel.getActors()[0];
		const location = stepModel.getLocation();
		let out = '';

		if (actor !== this.lastActor && actor) {
			out += `<CrewMember><Text>${actor}</Text></CrewMember>`;
		}
		if (location !== this.lastLocation && location) {
			out += `<Location><Text>${location}</Text></Location>`;
		}

		this.lastActor = actor;
		this.lastLocation = location;

		return out ? `<LocationInfo>${out}</LocationInfo>` : '';
	}

	insertStepFinalProcess(children, stepModel) {
		return [`<Step stepId="${stepModel.uuid}">${children.join('\n')}</Step>`];
	}

	addImages(images) {
		const imageXmlArray = [];
		const imagesPath = path.join(this.procedureWriter.program.imagesPath);
		const ipvXmlFolder = [this.procedure.ipvFields.mNumber].join('_');
		const imagesFolder = [ipvXmlFolder, 'files'].join('_');
		const ipvXmlFolderBuild = path.join(this.procedureWriter.program.outputPath, ipvXmlFolder);
		const buildPath = path.join(ipvXmlFolderBuild, imagesFolder);
		const refDocsFolder = path.join(ipvXmlFolderBuild, 'RefDocs');
		// FIX ME - used IPV fields to build appropriate folders
		const tempRefShelfFolder = path.join(refDocsFolder, 'SODF');
		const tempRefBookFolder = path.join(tempRefShelfFolder, 'IFM');
		const procDocsFolder = path.join(tempRefBookFolder, ipvXmlFolder.substring(2));

		const referenceFolders = [refDocsFolder, tempRefShelfFolder, tempRefBookFolder, procDocsFolder];

		// if image folder doesn't exist then make one

		if (!fs.existsSync(ipvXmlFolderBuild)) {
			fs.mkdirSync(ipvXmlFolderBuild);
		}
		if (!fs.existsSync(buildPath)) {
			fs.mkdirSync(buildPath);
		}
		for (const folder of referenceFolders) {
			if (!fs.existsSync(folder)) {
				fs.mkdirSync(folder);
			}
		}

		// var callback = function(pdf) {
		// 	// do something with the PDF like send it as the response
		// 	console.log(`Current directory: ${process.cwd()}`);
		// };

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

			const imageHtml = nunjucks.render('ipv-xml/refDocImage.html', {
				path: path.join(imageMeta.path),
				width: imageSize.width,
				height: imageSize.height,
				imageCaption: imageText
			});

			console.log(imageHtml);

			// eslint-disable-next-line max-statements-per-line
			// convertHTMLToPDF(imageHtml, callback, { path: path.join(procDocsFolder, [imageMeta.path.split('.')[0], 'pdf'].join('.')) });

			const config = {
				base: `file:///${buildPath}/`
			};

			// for some reason they change the F in figure names to rd for reference document
			const rdName = imageMeta.path.split('.')[0].replace('F', 'rd');

			console.log('buildpath :', buildPath);

			pdf.create(imageHtml, config).toFile(path.join(procDocsFolder, [rdName, 'pdf'].join('.')), function(err, res) {
				if (err) { return console.log(err); }
				console.log(res);
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
	addStepText(stepText) {

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
				texts.push(elem.join(''));
			}
		} else {
			throw new Error('addStepText() stepText must be string or array');
		}

		return texts;
	}

	// addCheckStepText(stepText, level, parent) {
	// return nunjucks.render('ipv-xml/checkbox-step-text.xml', {
	// parent,
	// level
	// });
	// }

	formatStepNumber(stepModel) {
		const numberedProps = ['title', 'text'];
		let stepNumber;
		if (stepModel.isSubstep()) {
			if (stepModel.getNumberingImpact() === 0) {
				return '';
			}
			const stepNumComponents = [
				stepModel.getRootStep().getActivityStepNumber(numberedProps)
			];
			stepNumComponents.push(...stepModel.getSubstepNumbers(numberedProps));
			stepNumber = stepNumComponents.join('.');
		} else {
			stepNumber = stepModel.getActivityStepNumber(numberedProps);
		}

		return `<StepNumber>${stepNumber}</StepNumber>`;
	}

	addTitleText(title, duration, stepModel) {
		const subtaskTitle = nunjucks.render('ipv-xml/subtask-title.xml', {
			title: this.textTransform.transform(title.toUpperCase().trim()).join(''),
			stepNumber: this.formatStepNumber(stepModel)
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
