/* Specify environment to include mocha globals, and directly callout enzyme globals */
/* eslint-env node, mocha */
/* eslint-disable-next-line no-unused-vars */
/* global shallow render mount */

'use strict';

const React = require('react');
const assert = require('chai').assert;
const TextTransform = require('./TextTransform');
const ReactTextTransform = require('./ReactTextTransform');

const testTaskGenerator = require('../../../test/generators/testTaskGenerator');

describe('ReactTextTransform', function() {

	const base = new ReactTextTransform([], [], {});

	describe('constructor', function() {

		const tt = new TextTransform('react', testTaskGenerator());

		const tests = [
			{ input: '{{CHECK}}', expected: (<React.Fragment key={'a'}>✓</React.Fragment>) },
			{ input: '{{CHECKBOX}}', expected: (<React.Fragment key={'b'}>☐</React.Fragment>) },
			{ input: '{{CHECKEDBOX}}', expected: (<React.Fragment key={'c'}>☑</React.Fragment>) },
			{ input: '{{LEFT}}', expected: (<React.Fragment key={'d'}>←</React.Fragment>) },
			{ input: '{{UP}}', expected: (<React.Fragment key={'e'}>↑</React.Fragment>) },
			{ input: '{{RIGHT}}', expected: (<React.Fragment key={'f'}>→</React.Fragment>) },
			{ input: '{{DOWN}}', expected: (<React.Fragment key={'g'}>↓</React.Fragment>) },
			{ input: 'GREEN', expected: base.reactColor('GREEN', 'green') }
		];

		for (const test of tests) {
			it(`should correctly transform ${test.input}`, function() {
				assert.strictEqual(
					render(tt.transform(test.input)).text(),
					render(test.expected).text()
				);
			});
		}
	});

	describe('reactColor()', function() {

		it('should make a properly color span', function() {
			const wrapper = shallow(base.reactColor('Some text', 'pink'));

			assert.strictEqual(
				wrapper.find('span').text(),
				'Some text'
			);
			assert.propertyVal(
				wrapper.find('span').get(0).props.style,
				'color',
				'pink'
			);
		});
	});

	describe('reactStringsToJSX()', function() {

		const tests = [
			{
				name: 'all-strings',
				input: ['this', 'is', 'a', 'test'],
				expected: ['this', 'is', 'a', 'test']
			},
			{
				name: 'strings+react',
				input: ['this', 'is', (<span key='abc'>a</span>), 'test'],
				expected: ['this', 'is', 'a', 'test']
			},
			{
				name: 'all-react',
				input: [
					(<div key='abc'>a</div>),
					(<span key='jkl'>b</span>),
					(<React.Fragment key='xyz'>c</React.Fragment>)
				],
				expected: ['a', 'b', 'c']
			}
		];

		for (const test of tests) {
			it(`should convert all strings to react objects for ${test.name} input`, function() {
				const out = base.reactStringsToJSX(test.input);

				for (let i = 0; i < test.input.length; i++) {
					assert.typeOf(out[i], 'object');
					assert.strictEqual(out[i].props.children, test.expected[i]);
				}
			});
		}
	});

});
