/* Specify environment to include mocha globals */
/* eslint-env node, mocha */
/* eslint-disable require-jsdoc */

'use strict';

const assert = require('chai').assert;

const ElectronProgram = require('./ElectronProgram');

describe('ElectronProgram', function() {

	// const MockReactAppComponent =
	class MockReactAppComponent {
		setProgram(program) {
			this.program = program;
		}

	}
	const mockReact = new MockReactAppComponent();
	const program = new ElectronProgram(mockReact);

	describe('constructor', function() {
		it('should setup link between self and App component', function() {
			assert.strictEqual(program, mockReact.program);
			assert.strictEqual(program.reactAppComponent, mockReact);
		});
	});

	describe('getHtmlImagePath()', function() {

		const testCases = [
			{
				input: { programImagesPath: '/unix/type/path', filename: 'thing.png' },
				expected: 'file:///unix/type/path/thing.png'
			},
			{
				input: { programImagesPath: 'C:\\\\windows\\type\\path', filename: 'thing.png' },
				expected: 'file://C:/windows/type/path/thing.png'
			},
			{
				input: { programImagesPath: '/path/with/!@#$%^&()_+/chars', filename: 'thing.png' },
				expected: 'file:///path/with/!%40%23%24%25%5E%26()_%2B/chars/thing.png'
			},
			{
				input: { programImagesPath: '/file/with/chars', filename: '!@#$%^&()_+thing.png' },
				expected: 'file:///file/with/chars/!%40%23%24%25%5E%26()_%2Bthing.png'
			}
		];

		for (const testCase of testCases) {
			it('should map fake1.yml to index 0', function() {
				program.imagesPath = testCase.input.programImagesPath;
				assert.strictEqual(
					program.getHtmlImagePath(testCase.input.filename),
					testCase.expected
				);
			});
		}

	});

});
