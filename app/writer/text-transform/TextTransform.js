'use strict';

const docx = require('docx');
const arrayHelper = require('../../helpers/arrayHelper');
let reactTextTransform; // only load this when needed, because JSX.

/**
 * Generate bold/colored text in a <span> for HTML
 * @param {string} text   Content of the text
 * @param {string} color  Color of the text
 * @return {string}
 */
function htmlColor(text, color) {
	return `<span style="font-weight:bold;color:${color};">${text}</span>`;
}

/**
 * Generate bold/colored text for DOCX
 * @param {string} text   Content of the text
 * @param {string} color  Color of the text
 * @return {docx.TextRun}
 */
function docxColor(text, color) {
	return new docx.TextRun({
		text: text,
		bold: true,
		color: color
	});
}

const transforms = [
	{
		template: {
			name: 'VERIFY',
			transformArgs: true,
			defaultTransformFn: (textTransformer, ...templateArgs) => {
				return ['Verify ', ...templateArgs]; // glue check onto front of returned array
			}
		},
		ipvXml: (textTransformer, ...templateArgs) => {
			// FIXME I think ipvXml looks something like this but this was just a guess for now
			return [`<verify><Symbol name="odf-checkmark"/> ${templateArgs.join(' ')}</verify>`];
		}
	},
	{
		template: {
			name: 'WIKI',
			transformArgs: false,
			defaultTransformFn: (textTransformer, ...templateArgs) => {
				// most output formats do nothing. requires react.
				return [templateArgs[1] || templateArgs[0]];
			}
		}
	},
	{
		template: {
			name: 'ROLE',
			transformArgs: false,
			defaultTransformFn: (textTransformer, ...templateArgs) => {
				const roleName = templateArgs[0];
				if (templateArgs.length > 1) {
					console.error('ROLE template should only have one argument: role name');
				}
				const task = textTransformer.task;
				const taskRole = task.rolesDict[roleName];
				if (!taskRole) {
					console.error(`Role ${roleName} does not appear to exist in activity ${task.title}`);
					return [`_invalid role name ${roleName}_`];
				} else {
					return [taskRole.actor];
				}
			}
		}
	},
	{
		template: {
			name: 'REF',
			transformArgs: true,
			defaultTransformFn: (textTransformer, ...templateArgs) => {
				return ['(', ...templateArgs, ')']; // glue check onto front of returned array
			}
		},
		ipvXml: (textTransformer, ...templateArgs) => {
			return [
				`
				<ReferenceInfo>
					<Text>(</Text>
					<Hyperlink target="${templateArgs.join(' ')}">
						<Text>Figure X</Text>
					</Hyperlink>
					<Text>)</Text>
				</ReferenceInfo>
				`
			];
		}
	},
	{
		text: '{{CHECK}}',
		html: '✓',
		ipvXml: '<Symbol name="odf-checkmark"/>',
		docx: '✓',
		react: null // see ReactTextTransform
	},
	{
		text: '{{CHECKBOX}}',
		html: '☐',
		ipvXml: '',
		docx: () => {
			return new docx.SymbolRun('F071');
		},
		react: null // see ReactTextTransform
	},
	{
		text: '{{CHECKEDBOX}}',
		html: '☑',
		docx: '☑',
		ipvXml: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{LEFT}}',
		html: '←',
		ipvXml: '<Symbol name="odf-left-arrow"/>',
		docx: new docx.SymbolRun('F0DF'), // FIXME should these new docx.SymbolRun be in funcs?
		react: null // see ReactTextTransform
	},
	{
		text: '{{UP}}',
		html: '↑',
		ipvXml: '<Symbol name="odf-up-arrow"/>',
		docx: new docx.SymbolRun('F0E1'),
		react: null // see ReactTextTransform
	},
	{
		text: '{{RIGHT}}',
		html: '→',
		ipvXml: '<Symbol name="odf-right-arrow"/>',
		docx: new docx.SymbolRun('F0E0'),
		react: null // see ReactTextTransform
	},
	{
		text: '{{DOWN}}',
		html: '↓',
		ipvXml: '<Symbol name="odf-down-arrow"/>',
		docx: new docx.SymbolRun('F0E2'),
		react: null // see ReactTextTransform
	},
	{
		text: '<',
		html: '<',
		ipvXml: '&lt;',
		docx: '<',
		react: null // see ReactTextTransform
	},
	{
		text: '&',
		html: '&',
		ipvXml: '&am;',
		docx: '&',
		react: null // see ReactTextTransform
	},
	{
		text: '{{DISCONNECT}}',
		html: '',
		ipvXml: '<Symbol name="odf-disconnect-symbol"/>',
		docx: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{CONNECT}}',
		html: '',
		ipvXml: '<Symbol name="odf-connect-symbol"/>',
		docx: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{COUNTERCLOCKWISE}}',
		html: '',
		ipvXml: '<Symbol name="odf-counterclockwise-sign"/>',
		docx: '',
		react: null // see ReactTextTransform
	},
	{
		text: '{{CLOCKWISE}}',
		html: '',
		ipvXml: '<Symbol name="odf-clockwise-sign"/>',
		docx: '',
		react: null // see ReactTextTransform
	}

];

/**
 * Add colors to list of transforms. Will add color transforms:
 *
 *  {
 *    text: 'BLACK',
 *    html: '<span style="font-weight:bold;color:black;">BLACK</span>',
 *    docx: TextRun {...}
 *    react: (<span style="font-weight:bold;color:black;">BLACK</span>) // <-- only if react in use
 *  }
 */
const colors = [
	{ text: 'GREEN', color: 'green' },
	{ text: 'RED', color: 'red' },
	{ text: 'YELLOW', color: '#FFC000' },
	{
		text: [
			'BLACK',
			'ANCHOR',
			'GO'
		],
		color: 'black'
	},
	{ text: 'BLUE', color: 'blue' },
	{ text: 'PURPLE', color: 'purple' },
	{ text: 'ORANGE', color: 'orange' }
];
const colorPointers = {};
for (const item of colors) {
	const texts = arrayHelper.parseArray(item.text);
	for (const text of texts) {
		transforms.push({
			text: text,
			html: htmlColor(text, item.color),
			docx: docxColor(text, item.color)
		});
		colorPointers[text] = transforms.length - 1; // for React transforms to easily be added
	}
}

/**
 *
 * @param {string} subject
 * @param {string} templateName
 * @param {string} opening
 * @param {string} closing
 * @return {Object}
 */
function extractTemplateCall(subject, templateName, opening = '{{', closing = '}}') {

	const initialOpening = `${opening}${templateName}`;
	const startIndex = subject.indexOf(initialOpening);
	const first = subject.slice(startIndex);
	let open = 1;
	let i = initialOpening.length - 1;
	while (i < first.length) {
		const checkClosing = first.slice(i, i + closing.length);

		// Required separate from checkClosing in off chance that open/close are diff length
		const checkOpening = first.slice(i, i + opening.length);
		if (checkClosing === closing) {
			open--;
			if (open === 0) {
				return {
					prefix: subject.slice(0, startIndex),
					templateCall: first.slice(0, i + closing.length),
					suffix: subject.slice(i + closing.length + startIndex)
				};
			}
			i += closing.length;
		} else if (checkOpening === opening) {
			open++;
			i += opening.length;
		} else {
			i++;
		}
	}
	throw new Error(`Missing closing ${closing} in:\n  ${subject}`);
}

/**
 * Format double braced template string
 * @param {string} subject
 * @param {Object} xform
 * @param {TextTransform} textTransformer
 * @return {Object}                Object in form
 *                                 {
 *                                   prefix: prefix,            <-- will be transformed later
 *                                   transformed: transformed,  <-- transformed text
 *                                   suffix: suffix             <-- will be transformed later
 *                                 }
 */
function replaceTemplate(subject, xform, textTransformer) { // specificTransformFn) {

	const { name, transformArgs, defaultTransformFn, trimArgs } = xform.template;
	const specificTransformFn = xform[textTransformer.format];

	// todo: determine if template names should allow more than alphanumeric+underscores
	if (!(/[a-zA-Z_]+/g).test(name)) {
		throw new Error('Find statement does not match regular expression: /[a-zA-Z_]+/');
	}

	const openChars = '{{';
	const closeChars = '}}';
	const argDelimiter = '|';
	const { prefix, templateCall, suffix } = extractTemplateCall(
		subject, name, openChars, closeChars
	);

	let templateArgs = templateCall
		.trim() // remove whitespace from beginning or end. Probably not necessary
		.slice(openChars.length, -closeChars.length) // strip open/clos chars, prob {{ and }}
		.split(argDelimiter) // break into an array
		.slice(1); // strip off the first part, which is the template name like "VERIFY"

	// default: trim whitespace off of args
	// If { template: { trimArgs: false } } not explicitly set, trim off the whitespace
	if (trimArgs !== false) {
		templateArgs = templateArgs.map((text) => {
			return text.trim();
		});
	}

	// default: don't transform arg text
	// whether to transform the {{GREEN}} inside {{VERIFY | This text is {{GREEN}} }}
	if (transformArgs) {
		templateArgs = templateArgs.map((arg) => {
			return textTransformer.transform(arg);
		});

		// the above map will create an array of arrays, since each textTransformer.transform()
		// returns an array. Flatten one level deep here
		templateArgs = Array.prototype.concat(...templateArgs);
	}

	// if a specific function is specified like { html: (args) => {...} } use that, else use
	// default { template: { defaultTransformFn: (args) => {...} } }
	const transformed = specificTransformFn ?
		specificTransformFn(textTransformer, ...templateArgs) :
		defaultTransformFn(textTransformer, ...templateArgs);

	return {
		prefix: prefix,
		transformed: transformed,
		suffix: suffix
	};
}

/**
 * Takes in a subject string and splits it at a transformable substring. That substring is
 * transformed accordingly, and the text before (prefix) and after (suffix) are returned unchanged
 * along with the transformed text.
 *
 * @param {string} subject
 * @param {Object} xform        Element of 'transforms' array. Example:
 *                                {
 *                                  text: '{{CHECK}}',
 *                                  html: '✓',
 *                                  docx: '✓',
 *                                  react: null // see ReactTextTransform
 *                                }
 * @param {TextTransform} textTransformer
 * @return {Object}             Example: { prefix: ..., transformed: ..., suffix: ... }
 */
function splitStringAndTransform(subject, xform, textTransformer) {

	if (xform.text) {
		// In `text`, get the start and end index of xform.text
		const searchStart = subject.indexOf(xform.text);
		const searchEnd = searchStart + xform.text.length;

		// prefix and suffix are strings before and after xform.text. Transform xform.text
		const result = {
			prefix: subject.substring(0, searchStart),

			// todo: if no textTransformer.format found, don't transform for this type. Instead
			// just return something like { prefix: 'whole untransformed string, transformed: '',
			// suffix: '' }. Perhaps also come up with a way to have a default transform, or a
			// hierarchy (one transform falls back on another)
			transformed: xform[textTransformer.format],
			suffix: subject.substring(searchEnd)
		};

		// if result.transform isn't actually the tranformed result, but instead is a function, use
		// that function to generate the result.
		if (typeof result.transformed === 'function') {
			result.transformed = result.transformed(xform.text);
		}
		return result;
	} else if (xform.template) {
		return replaceTemplate(subject, xform, textTransformer);
	} else {
		throw new Error('Transform must include a .text or .template key');
	}

}

/**
 * Find next transform, perform it or return false
 *
 * @param {string} subject String to find transforms in
 * @param {TextTransform} textTransformer
 * @return {Object|boolean}  False if no transformable substrings found in text. Otherwise return
 *                           output of splitStringAndTransform(). See those docs.
 */
function findNextTransform(subject, textTransformer) {
	for (const xform of transforms) {
		const search = xform.template ? `{{${xform.template.name}` : xform.text;
		if (subject.indexOf(search) !== -1) {
			return splitStringAndTransform(subject, xform, textTransformer);
		}
	}
	return false;
}

/**
 * Perform all transforms on text. This function is called recursively until no more transforms are
 * found.
 *
 * @param {string} text Text on which to perform all transforms
 * @param {TextTransform} textTransformer
 * @return {Array}
 */
function doTransform(text, textTransformer) {
	if (!text) {
		return [];
	}

	const transform = findNextTransform(text, textTransformer);
	if (transform) {
		const result = doTransform(transform.prefix, textTransformer); // recurse until no prefix
		if (Array.isArray(transform.transformed)) {
			result.push(...transform.transformed);
		} else {
			result.push(transform.transformed);
		}
		result.push(...doTransform(transform.suffix, textTransformer)); // recurse until no suffix
		return result;
	} else {
		return [text];
	}
}

/**
 * Convert all strings to docx.TextRun objects.
 *
 * When the TextTransform class is complete transforming a string for the docx transform type, the
 * array outputted must not include any strings.
 *
 * @param {Array} transformArr  Array which may include docx.TextRun objects and strings (and
 *                              perhaps other docx types).
 * @return {Array}              Array which shall not include strings
 */
function docxStringsToTextRuns(transformArr) {
	return transformArr.map((cur) => {
		return typeof cur === 'string' ? new docx.TextRun(cur) : cur;
	});
}

module.exports = class TextTransform {

	constructor(format, task) {
		this.task = task;
		if (!this.task.constructor && !this.task.constructor.name &&
			this.task.constructor.name !== 'Task') {
			throw new Error('TextTransform.task must be an instance of Task');
		}

		const validFormats = ['ipvXml', 'html', 'docx', 'react'];
		if (validFormats.indexOf(format) === -1) {
			throw new Error(`new TextWriter(format) requires format to be in ${validFormats.toString()}`);
		}
		this.format = format;

		// modify transforms to include React transforms if (1) using React and (2) prior
		// TextTransform objects haven't already modified them
		if (this.format === 'react' && !reactTextTransform) {
			// console.log('Creating React text transforms');
			const ReactTextTransform = require('./ReactTextTransform');

			// instantiate in module context
			reactTextTransform = new ReactTextTransform(transforms, colors, colorPointers);
		}
	}

	transform(text) {
		let transform = doTransform(text, this);
		if (this.format === 'docx') {
			transform = docxStringsToTextRuns(transform);
		} else if (this.format === 'react') {
			transform = reactTextTransform.reactStringsToJSX(transform);
		}
		return transform;
	}

	/**
	 * Exposed outside module purely for testing
	 * @param {string} text string like "RED"
	 * @param {string} color string like "red". If omitted, use `text` as the color.
	 * @return {string} HTML like <span style="font-weight:bold;color:red;">RED</span>
	 */
	htmlColor(text, color) {
		if (!color) {
			color = text.toLowerCase();
		}
		return htmlColor(text, color);
	}
};
