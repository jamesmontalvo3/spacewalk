#!/usr/bin/env node

'use strict';

if (!process.argv[2]) {
	console.error('You must pass a valid path to the xml zip file into this script');
	process.exit(1);
}

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');

const ipvZipFile = path.join(process.cwd(), process.argv[2]);
const ipvFileDir = path.dirname(ipvZipFile);
const basename = path.basename(ipvZipFile, path.extname(ipvZipFile));

// Extract IPV Zip file that contains XML and Images
const zip = new AdmZip(ipvZipFile);
zip.extractAllTo(ipvFileDir, true);

const ipvFile = path.join(ipvFileDir, `${basename}.xml`);

const projectDir = path.dirname(ipvFileDir);
const tasksDir = path.join(projectDir, 'tasks'); // should be called activityDir need to fix when merging
const procsDir = path.join(projectDir, 'procedures');
const ipvSourceImageDir = path.join(ipvFileDir, `${basename}_files`);
const imagesDir = path.join(projectDir, 'images');
const odfSymbols = require('./odfSymbolMap.js');

if (!fs.existsSync(tasksDir)) {
	fs.mkdirSync(tasksDir);
}
if (!fs.existsSync(procsDir)) {
	fs.mkdirSync(procsDir);
}
if (!fs.existsSync(procsDir)) {
	fs.mkdirSync(imagesDir);
}

// Read file directory from xml zip file and move images to patify image folder
fs.readdir(ipvSourceImageDir, function(err, files) {
	if (err) {
		throw err;
	}
	files.forEach(function(file) {
		fs.rename(path.join(ipvSourceImageDir, file), path.join(imagesDir, file), (err) => {
			if (err) {
				throw err;
			}

		});

	});

});

if (!['.xml'].includes(path.extname(ipvFile))) {
	// Should perform more specific test to check xml is using IPV format
	console.error(`${ipvFile} does not appear to be an XML file`);
	process.exit(1);
}

// Checks if file path exists
if (!fs.existsSync(ipvFile)) {
	console.error(`${ipvFile} is not a valid file`);
	process.exit(1);
}

try {
	console.log('Loading XML');
	var $ = cheerio.load(
		fs.readFileSync(ipvFile),
		{
			xmlMode: true,
			lowerCaseTags: true
		}
	);
	console.log('XML loaded');
} catch (err) {
	throw new Error(err);
}

/**
 * Returns cleaned up text from given object
 * @param {Object} input object to obtain clean text from
 * @return {string}      sanatized text
 */
function sanatizeInput(input) {
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
function compareTag(subject, comparison, option = 'tagName') {
	if (option === 'tagName') {
		return $(subject).prop('tagName').toLowerCase() === comparison;
	} else if (option === 'includes') {
		return $(subject).prop('tagName').toLowerCase().includes(comparison);
	}
}

/**
 * parse trhough itemized list tags (location, duration, crew)
 * @param  {Array} input     array of itemized list items
 * @return {string}          yaml markup for location, duration, crew,
 *                           ref procedures
 */
function getItemizedList(input) {
	const outPut = [];
	$('itemizedlist').each(function(index, element) {
		const listTitle = sanatizeInput($(element).find('listtitle'))
			.replace(':', '')
			.replace(' ', '')
			.replace('(', '')
			.replace(')', '')
			.toLowerCase();
		if (listTitle === input) {
			$(element).children('para').each(function(index, element) {
				outPut.push(sanatizeInput($(element)));
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
function getImages(element) {
	let imageYaml = {};

	$(element).children('image').each(function(index, element) {
		imageYaml = [{
			path: $(element).find('imagereference').attr('source').replace(/(.*)\//, ''),
			text: sanatizeInput($(element).find('imagetitle > text')),
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

function getProcHeader() {
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
			date: sanatizeInput($('metadata > date')),
			mNumber: sanatizeInput($('metadata > uniqueid')),
			book: sanatizeInput($('metadata > book')),
			applicability: sanatizeInput($('metadata > applicability')),
			ipvVersion: sanatizeInput($('metadata > version')),
			procCode: sanatizeInput($('metadata > proccode')),
			ipvLocation: getItemizedList('location'),
			ipvDuration: getItemizedList('duration'),
			crewRequired: getItemizedList('crew'),
			referencedProcedures: getItemizedList('referencedprocedures')
		},
		// getToolsPartsMarterials(),
		columns: [
			{
				key: 'IV',
				actors: ['*']
			}
		],
		tasks: [{
			file: `${basename}.yml`,
			roles: { IV1: 'IV' }
		}]
	};
	return yaml.safeDump(outPut);
}

function replaceFigureCalls(instructionElement) {
	let textToReturn = '';
	$(instructionElement).find('ReferenceInfo').each(function(index, referenceElement) {
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

function buildStepFromElement(givenElement) {
	const steps = [];
	let currentComponent = {};
	$(givenElement).children().each(function(index, currentElement) {

		if (compareTag(currentElement, 'steptitle')) {
			const instructionText = replaceFigureCalls($(currentElement).find('instruction'));
			const titleText = sanatizeInput($(currentElement).children('text'));
			if (instructionText) {
				if (!currentComponent.text) {
					currentComponent.text = [];
				}
				currentComponent.text.push(instructionText);
			}
			if (titleText.length > 0) {
				if (Object.keys(currentComponent).length > 0) {
					steps.push(currentComponent);
					currentComponent = {};
				}
				currentComponent.title = titleText;
			}
		}

		if (compareTag(currentElement, 'stepcontent')) {
			const instruction = replaceFigureCalls($(currentElement).find('instruction'));
			const image = sanatizeInput($(currentElement).find('image'));
			if (instruction.length > 0) {
				currentComponent.text = currentComponent.text || [];
				currentComponent.text.push(instruction);
			}
			if (image) {
				currentComponent.images = currentComponent.images || [];
				currentComponent.images.push(...getImages(currentElement));
			}
		}

		if (compareTag(currentElement, 'clarifyinginfo')) {
			const ncwType = $(currentElement).attr('infoType');
			currentComponent[ncwType] = currentComponent[ncwType] || [];
			$(currentElement).children('infotext').each(function(index, ncwText) {
				currentComponent[ncwType].push(sanatizeInput($(ncwText)));
			});
		}

		if (compareTag(currentElement, 'step')) {
			currentComponent.substeps = currentComponent.substeps || [];
			currentComponent.substeps.push(...buildStepFromElement(currentElement));
		}

	});

	if (Object.keys(currentComponent).length > 0) {
		steps.push(currentComponent);
	}

	return steps;

}

function buildActivity() {
	const activity = {
		title: basename,
		roles: [{
			name: 'IV1',
			duration: {
				minutes: 150
			}
		}],
		steps: [{ IV: [] }]
	};

	activity.steps[0].IV.push(...buildStepFromElement('ChecklistProcedure > step'));

	return yaml.safeDump(activity);

}

$('VerifyCallout').each(function(index, element) {
	const verifyType = $(element).attr('verifyType').toUpperCase();
	const verifyParent = $(element).parent();
	$(verifyParent).prepend(`<text>{{${verifyType}}}</text>`);
});

$('Symbol').each(function(index, element) {
	const symbolType = $(element).attr('name');
	const maestroSymbol = odfSymbols.odfToMaestro(symbolType);
	$(element).prepend(`<text>${maestroSymbol}</text>`);
});

$('verifyoperator').each(function(index, element) {
	const symbolType = $(element).attr('operator').toUpperCase();
	$(element).prepend(`<text>{{${symbolType}}}</text>`);
});

// write procedure file
fs.writeFileSync(path.join(procsDir, `${basename}.yml`), `${getProcHeader()}`);
// write task file
fs.writeFileSync(path.join(tasksDir, `${basename}.yml`), `${buildActivity()}`);
