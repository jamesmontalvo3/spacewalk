/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;

const TemplateTransform = require('./TemplateTransform');
const TextTransform = require('./TextTransform');

describe('TemplateTransform', function() {

	describe('#constructor', function() {
		// probably nothing to test here
	});

	describe('replaceTemplate()', function() {

		// FIXME set these up for testing purposes. They'll have to live somewhere in the Maestro
		// codebase, probably within TextTransform.js
		const testTemplateName = 'VERIFY';
		const testReplacerFn = function(argsArray) {
			return `<strong>VERIFY:</strong> ${argsArray[0]}`;
		};

		const testCases = [
			{
				input: 'Do some {{VERIFY | this is a test}} stuff',
				expected: {
					prefix: 'Do some ',
					transformed: '<strong>VERIFY:</strong> this is a test',
					suffix: ' stuff'
				}
			},
			{
				input: 'Do some {{VERIFY | this is a {{GREEN}} test}} stuff',
				expected: {
					prefix: 'Do some ',
					transformed: '<strong>VERIFY:</strong> this is a HOWEVERGREENHTMLLOOKS test',
					suffix: ' stuff'
				}
			}
		];

		const templateTransform = TemplateTransform(new TextTransform('html'));

		for (const testCase of testCases) {
			it(`should return ${testCase.expected} on input ${testCase.input}`, function() {
				assert.deepStrictEqual(
					templateTransform.replaceTemplate(
						testCase.input, testTemplateName, testReplacerFn
					),
					testCase.expected
				);
			});
		}
	});

});
