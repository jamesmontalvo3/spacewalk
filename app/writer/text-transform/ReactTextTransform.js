'use strict';

const React = require('react');
const uuidv4 = require('uuid/v4');
const arrayHelper = require('../../helpers/arrayHelper');

// NOTE: The keys in the object below must all be present within TextTransform's 'transforms' array
const reactTransforms = {
	'{{CHECK}}': (<React.Fragment key={uuidv4()}>✓</React.Fragment>),
	'{{CHECKBOX}}': (<React.Fragment key={uuidv4()}>☐</React.Fragment>),
	'{{CHECKEDBOX}}': (<React.Fragment key={uuidv4()}>☑</React.Fragment>),
	'{{LEFT}}': (<React.Fragment key={uuidv4()}>←</React.Fragment>),
	'{{UP}}': (<React.Fragment key={uuidv4()}>↑</React.Fragment>),
	'{{RIGHT}}': (<React.Fragment key={uuidv4()}>→</React.Fragment>),
	'{{DOWN}}': (<React.Fragment key={uuidv4()}>↓</React.Fragment>)
};

const reactTemplateTransforms = {
	WIKI: (...args) => {
		const goToWiki = () => {
			const { shell } = require('electron');
			shell.openExternal(`https://wiki.jsc.nasa.gov/iss/index.php/${args[0]}`);
		};

		return [
			<a key={args.join('-')} onClick={goToWiki} href='#'>
				{args[1] || args[0]}
			</a>
		];
	}
};

module.exports = class ReactTextTransform {

	/**
	 *
	 * @param {Array} baseTransforms  Reference to transforms used by base TextTransform class
	 *                                  [
	 *                                    {
	 *                                      text: 'sometext',
	 *                                      html: 'html output of text',
	 *                                      docx: 'docx output of text',
	 *                                      react: null   <-- placeholder filed in by this class
	 *                                    },
	 *                                    ...
	 *                                  ]
	 * @param {Array} colors          Array of objects with .text being text to look for, and .color
	 *                                being the color to change that text to. Example:
	 *                                  colors = [{text: 'GREEN', color: 'green'}]
	 *                                In this example any use of all-caps "GREEN" will be turned
	 *                                green.
	 * @param {Object} colorPointers  From 'colors' param, pointer to each transform created by
	 *                                each color.text. This allows this class to find the correct
	 *                                place to put React transforms. Example:
	 *                                  colorPointers = {
	 *                                    'GREEN': point to baseTransforms[0],
	 *                                    'RED': point to baseTransforms[1]
	 *                                  }
	 *                                    when:
	 *                                  colors = [{text: 'GREEN', color: 'green'}, { 'RED': ... }]
	 *                                    and:
	 *                                  baseTransforms started as empty [], but now is:
	 *                                  baseTransforms = [
	 *                                    { text: 'GREEN', ... },
	 *                                    { text: 'RED', ... }
	 *                                  ]
	 */
	constructor(baseTransforms, colors, colorPointers) {

		for (const item of colors) {
			const texts = arrayHelper.parseArray(item.text);
			for (const text of texts) {
				// console.log(`Adding react color transform for ${text} --> ${item.color}`);
				baseTransforms[colorPointers[text]].react = this.reactColor(text, item.color);
			}
		}

		for (const xform of baseTransforms) {
			// skip over those already added above (colors)
			if (!xform.react) {
				if (reactTransforms[xform.text]) {
					xform.react = reactTransforms[xform.text];
				}
			}
		}

		for (const xform of baseTransforms) {
			if (xform.template && reactTemplateTransforms[xform.template.name]) {
				xform.react = reactTemplateTransforms[xform.template.name];
			}
		}

	}

	/**
	 *
	 * @param {string} text
	 * @param {string} color
	 * @return {any}   React <span> object
	 */
	reactColor(text, color) {
		return (<span key={uuidv4()} style={{ fontWeight: 'bold', color: color }}>{text}</span>);
	}

	reactStringsToJSX(transformArr) {
		return transformArr.map((cur) => {
			return typeof cur === 'string' ?
				(<React.Fragment key={uuidv4()}>{cur}</React.Fragment>) :
				cur;
		});
	}

};
