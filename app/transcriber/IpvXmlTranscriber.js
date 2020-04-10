#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');
const odfSymbols = require('./odfSymbolMap.js');
var $;
var currentComponent = {};

module.exports = class IpvXmlTranscriber {
	constructor(file) {
		this.file = file;
		this.ipvZipFile = path.join(process.cwd(), file);
		this.ipvFileDir = path.dirname(this.ipvZipFile);
		this.basename = path.basename(this.ipvZipFile, path.extname(this.ipvZipFile));
		this.zip = new AdmZip(this.ipvZipFile);
		this.ipvFile = path.join(this.ipvFileDir, `${this.basename}.xml`);
		this.projectDir = path.dirname(this.ipvFileDir);
		this.tasksDir = path.join(this.projectDir, 'tasks'); // should be called activityDir need to fix when merging
		this.procsDir = path.join(this.projectDir, 'procedures');
		this.ipvSourceImageDir = path.join(this.ipvFileDir, `${this.basename}_files`);
		this.imagesDir = path.join(this.projectDir, 'images');
	}

	/**
	 * Returns cleaned up text from given object
	 * @param {string} input object to obtain clean text from
	 * @return {string}      sanatized text
	 */
	sanatizeInput(input) {
		return input.text().trim()
			.replace(/\s+/g, ' ')
			.replace(/&/g, '&amp;');
	}

	/**
	 *
	 * @param {Object} subject      object with tag that you want to compare
	 * @param {string} comparison   string to compare with
	 * @param {string} option       how to compare: tagName or includes tagName
	 * @return {boolean}
	 */
	compareTag(subject, comparison, option = 'tagName') {
		if (option === 'tagName') {
			return $(subject).prop('tagName').toLowerCase() === comparison;
		} else if (option === 'includes') {
			return $(subject).prop('tagName').toLowerCase().includes(comparison);
		}
	}

	/**
	 * parse trhough itemized list tags (location, duration, crew)
	 * @param  {string} input     array of itemized list items
	 * @return {Array}          yaml markup for location, duration, crew,
	 *                           ref procedures
	 */
	getItemizedList(input) {
		const outPut = [];
		$('itemizedlist').each((index, element) => {
			const listTitle = this.sanatizeInput($(element).find('listtitle'))
				.replace(':', '')
				.replace(' ', '')
				.replace('(', '')
				.replace(')', '')
				.toLowerCase();

			if (listTitle === input) {
				$(element).children('para').each((index, element) => {
					outPut.push(this.sanatizeInput($(element)));
				});
			}

		});

		return outPut;
	}

	/**
 *
 * @param {Object} element tools, parts, or materials object
 * @param {string} indent  current yaml indent for output
 * @param {string} outPut  yaml output
 * @return {string}        yaml output
 */
	/*
function parseTools(element, indent, outPut = '') {
	const toolsOutput = [];
	$(element).children().each(function(index, element) {
		if (compareTag(element, 'toolsitem')) {
			toolsOutput[index] = {
				toolName: sanatizeInput($(element).children('toolsitemname')),
				partNumber: sanatizeInput($(element).children('partnumber')),
				quantity: sanatizeInput($(element).children('quantity')),
				comment: sanatizeInput($(element).children('comment'))
			};

outPut += `${indent}- toolName: ${sanatizeInput($(element).children('toolsitemname'))}\n`;
outPut += `${indent}  partNumber: "${sanatizeInput($(element).children('partnumber'))}"\n`;
			outPut += `${indent}  quantity: "${sanatizeInput($(element).children('quantity'))}"\n`;
			outPut += `${indent}  comment: '${sanatizeInput($(element).children('comment'))}'\n`;
		} else if (compareTag(element, 'containeritem', 'includes')) {
			return;
		} else if (compareTag(element, 'container', 'includes')) {
			toolsOutput[index] = {
				containerName: $(element).children('containeritem').text().trim(),
				containerContents: ''
			};
	outPut += `${indent}- containerName: ${$(element).children('containeritem').text().trim()}\n`;
			outPut += `${indent}  containerContents:\n`;
		} else {
			toolsOutput[index] = '';
		}

		// parseTools(element, indent + '  ');
	});
	// console.log(toolsOutput);
	// console.log(yaml.safeDump(toolsOutput));

	return outPut;

}
*/

	/**
 * Runs parseTools for tools, parts, materials section
 * @return {string}     yaml output
 */
	/*
function getToolsPartsMarterials() {
	let outPut = '';
	const sectionList = ['parts', 'materials', 'tools'];
	sectionList.forEach((element) => {

		outPut += `${element}:\n`;
		outPut += parseTools(element, '  ');

	});

	return outPut;
}
*/

	/**
	 * retrieves yaml output for an image
	 * @param {Object} element  xml tag with image in it
	 * @param {string} indent   current yaml indent
	 * @return {string}         yaml output
	 */
	getImages(element) {
		let imageYaml = {};

		$(element).children('image').each((index, element) => {
			imageYaml = [{
				path: $(element).find('imagereference').attr('source').replace(/(.*)\//, ''),
				text: this.sanatizeInput($(element).find('imagetitle > text')),
				width: parseInt(($(element).find('imagereference').attr('width'))),
				height: parseInt($(element).find('imagereference').attr('height')),
				alt: $(element).find('imagereference').attr('alt').replace(/(.*)\//, '')
			}];

		});

		return imageYaml;
	}

	/**
 * retrieves header content of procedure
 * @return {string}  procedure header yaml
 */
	getProcHeader() {
		const outPut = {
		// eslint-disable-next-line camelcase
			procedure_name: $('proctitle > text').text().trim(),
			ipvFields: {
				procNumber: $('proctitle > procnumber').text().trim(),
				schemaVersion: $('schemaversion').text().trim(),
				authoringTool: $('authoringtool').text().trim(),
				objective: $('procedureobjective').text().trim(),
				procType: $('metadata').attr('procType'),
				status: $('metadata').attr('status'),
				date: this.sanatizeInput($('metadata > date')),
				mNumber: this.sanatizeInput($('metadata > uniqueid')),
				book: this.sanatizeInput($('metadata > book')),
				applicability: this.sanatizeInput($('metadata > applicability')),
				ipvVersion: this.sanatizeInput($('metadata > version')),
				procCode: this.sanatizeInput($('metadata > proccode')),
				ipvLocation: this.getItemizedList('location'),
				ipvDuration: this.getItemizedList('duration'),
				crewRequired: this.getItemizedList('crew'),
				referencedProcedures: this.getItemizedList('referencedprocedures')
			},
			// getToolsPartsMarterials(),
			columns: [
				{
					key: 'IV',
					actors: ['*']
				}
			],
			tasks: [{
				file: `${this.basename}.yml`,
				roles: { IV1: 'IV' }
			}]
		};
		return yaml.safeDump(outPut);
	}

	/**
	 * Changes figure references into {{REF}} tags
	 * @param {Object} instructionElement  xml tag with image in it
	 * @return {string}         yaml output
	 */
	replaceFigureCalls(instructionElement) {
		let textToReturn = '';
		$(instructionElement).find('ReferenceInfo').each((index, referenceElement) => {
			if (referenceElement) {
			// FIXME ref links point to PDFs, not actual images would make sense to point to images.
				const hyperlinkTarget = $(referenceElement).find('Hyperlink').attr('target');
				$(referenceElement).html(`<text>{{REF|${hyperlinkTarget}}}</text>`);

			}

		});

		textToReturn = instructionElement.text().trim()
			.replace(/\((\s)*{{REF/g, '{{REF')
			.replace(/{{REF\|((\w|\/)*\.(\w*))}}(\s)*\)/g, '{{REF|$1}}')
			.replace(/\((\s)*Figure\s\d{1,}(\s)*\)/g, '')
			.replace(/\s+/g, ' ')
			.replace(/&/g, '&amp;');

		return textToReturn;

	}

	/**
	 * Builds step yaml from xml object
	 * @param {Object} currentElement current selected XML element
	 * @return {string}
	 */
	addstepTitle(currentElement) {
		let steps = '';
		const instructionText = this.replaceFigureCalls($(currentElement).find('instruction'));
		const titleText = this.sanatizeInput($(currentElement).children('text'));
		if (instructionText) {
			if (!currentComponent.text) {
				currentComponent.text = [];
			}
			currentComponent.text.push(instructionText);
		}
		if (titleText.length > 0) {
			if (Object.keys(currentComponent).length > 0) {
				steps = currentComponent;
				currentComponent = {};
			}
			currentComponent.title = titleText;
		}

		return steps;

	}

	/**
	 * Pushes step yaml to currentComponent var from xml object
	 * @param {Object} currentElement current selected XML element
	 */
	addstepContent(currentElement) {
		const instruction = this.replaceFigureCalls($(currentElement).find('instruction'));
		const image = this.sanatizeInput($(currentElement).find('image'));
		if (instruction.length > 0) {
			currentComponent.text = currentComponent.text || [];
			currentComponent.text.push(instruction);
		}
		if (image) {
			currentComponent.images = currentComponent.images || [];
			currentComponent.images.push(...this.getImages(currentElement));
		}

	}

	/**
 * Builds yaml step output from xml element
 * @param {Object} givenElement  xml tag with step content
 * @return {string}         yaml output
 */
	buildStepFromElement(givenElement) {
		const steps = [];

		$(givenElement).children().each((index, currentElement) => {

			if (this.compareTag(currentElement, 'steptitle')) {
				steps.push(this.addStepTitle());
			}

			if (this.compareTag(currentElement, 'stepcontent')) {
				this.addstepContent();
			}

			if (this.compareTag(currentElement, 'clarifyinginfo')) {
				const ncwType = $(currentElement).attr('infoType');
				currentComponent[ncwType] = currentComponent[ncwType] || [];
				$(currentElement).children('infotext').each((index, ncwText) => {
					currentComponent[ncwType].push(this.sanatizeInput($(ncwText)));
				});
			}

			if (this.compareTag(currentElement, 'step')) {
				currentComponent.substeps = currentComponent.substeps || [];
				currentComponent.substeps.push(...this.buildStepFromElement(currentElement));
			}

		});

		if (Object.keys(currentComponent).length > 0) {
			steps.push(currentComponent);
		}

		return steps;

	}

	/**
	 * Builds activity yaml
	 * @return {string}         yaml output
	 */
	buildActivity() {
		const activity = {
			title: this.basename,
			roles: [{
				name: 'IV1',
				duration: {
					minutes: 150
				}
			}],
			steps: [{ IV: [] }]
		};

		activity.steps[0].IV.push(...this.buildStepFromElement('ChecklistProcedure > step'));

		return yaml.safeDump(activity);

	}

	/**
	 * Validates input passed to maestro compose command
	 */

	validateInput() {
		if (!['.xml'].includes(path.extname(this.ipvFile))) {
			// Should perform more specific test to check xml is using IPV format
			console.error(`${this.ipvFile} does not appear to be an XML file`);
			process.exit(1);
		}

		// Checks if file path exists
		if (!fs.existsSync(this.ipvFile)) {
			console.error(`${this.ipvFile} is not a valid file`);
			process.exit(1);
		}

		try {
			console.log('Loading XML');
			$ = cheerio.load(
				fs.readFileSync(this.ipvFile),
				{
					xmlMode: true,
					lowerCaseTags: true
				}
			);
			console.log('XML loaded');
		} catch (err) {
			throw new Error(err);
		}
	}

	/**
	 * Builds maestro directories
	 */
	buildDirectory() {
		this.zip.extractAllTo(this.ipvFileDir, true);

		if (!fs.existsSync(this.tasksDir)) {
			fs.mkdirSync(this.tasksDir);
		}
		if (!fs.existsSync(this.procsDir)) {
			fs.mkdirSync(this.procsDir);
		}
		if (!fs.existsSync(this.imagesDir)) {
			fs.mkdirSync(this.imagesDir);
		}

		// Read file directory from xml zip file and move images to patify image folder
		fs.readdir(this.ipvSourceImageDir, (err, files) =>{
			if (err) {
				throw err;
			}
			files.forEach((file) => {
				fs.rename(
					path.join(this.ipvSourceImageDir, file),
					path.join(this.imagesDir, file),
					(err) => {
						if (err) {
							throw err;
						}

					});

			});

		});

		this.validateInput();

	}

	/**
	 * Converts XML symbol tags to Maestro tags
	 */
	symbolCleanup() {
		$('VerifyCallout').each((index, element) => {
			const verifyType = $(element).attr('verifyType').toUpperCase();
			const verifyParent = $(element).parent();
			$(verifyParent).prepend(`<text>{{${verifyType}}}</text>`);
		});

		$('Symbol').each((index, element) => {
			const symbolType = $(element).attr('name');
			const maestroSymbol = odfSymbols.odfToMaestro(symbolType);
			$(element).prepend(`<text>${maestroSymbol}</text>`);
		});

		$('verifyoperator').each((index, element) => {
			const symbolType = $(element).attr('operator').toUpperCase();
			$(element).prepend(`<text>{{${symbolType}}}</text>`);
		});

	}

	transcribe() {
		this.buildDirectory();
		this.symbolCleanup();
		// write procedure file
		fs.writeFileSync(path.join(this.procsDir, `${this.basename}.yml`), `${this.getProcHeader()}`);
		// write task file
		fs.writeFileSync(path.join(this.tasksDir, `${this.basename}.yml`), `${this.buildActivity()}`);
	}

};
