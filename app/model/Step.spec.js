/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;

const YAML = require('js-yaml');

const Step = require('./Step');

const Task = require('./Task');
const testProcedureGenerator = require('../../test/generators/testProcedureGenerator');
const procedure = testProcedureGenerator('simple/procedures/proc.yml');
const aTask = new Task(
	{
		file: 'some-task.yml',
		roles: { crewA: 'EV1', crewB: 'EV2' },
		color: '#7FB3D5'
	},
	procedure,
	{
		title: 'Some Task',
		roles: [
			{
				name: 'crewA',
				description: 'Person who does XYZ',
				duration: { minutes: 20 }
			},
			{
				name: 'crewB',
				description: 'Person who does ABC',
				duration: { minutes: 20 }
			}
		],
		steps: [
			{ simo: { IV: [], EV1: [], EV2: [] } }
		]
	}
);

/**
 * Positive testing for step
 */
describe('Step constructor - Positive Testing', function() {
	describe('Normal Input without arrays', () => {

		const yamlString = `
            step: '{{CHECK}} All gates closed & hooks locked'
            title: 'Initial Configuration'
            duration:
                minutes: 5
            checkboxes: '{{CHECKMARK}} R Waist Tether to EV2 Blank hook'
            images:
              - path: "./WVSRecorders.png"
            substeps: select page - RF camera.
            warning: Do not touch the hinged side while closing the MISSE PECs (Pinch Point)
            caution: Avoid inadverntent contat with the deployed MISSE PECs, which have shatterable materials, and the silver avionics boxes atop the ExPA
            comment: this is a comment
            note: this is a note
        `;

		const yamlObject = YAML.safeLoad(yamlString);

		it('should return a procedure for normal input', () => {

			const step = new Step(yamlObject, aTask.concurrentSteps[0].subscenes.EV1);

			expect(step).to.exist; // eslint-disable-line no-unused-expressions

			assert.isString(step.props.title);
			assert.strictEqual(step.props.title, 'Initial Configuration');

			assert.isArray(step.props.text);
			assert.strictEqual(step.props.text[0], '{{CHECK}} All gates closed & hooks locked');

			expect(step.props.images).to.be.a('array');
			expect(step.props.images).to.have.all.keys(0);
			expect(step.props.images[0]).to.be.a('object');
			expect(step.props.images[0].path).to.be.a('string');
			expect(step.props.images[0].path).to.equal('./WVSRecorders.png');

			expect(step.props.checkboxes).to.be.a('array');
			expect(step.props.checkboxes).to.have.all.keys(0);
			expect(step.props.checkboxes[0]).to.be.a('string');
			expect(step.props.checkboxes[0]).to.equal('{{CHECKMARK}} R Waist Tether to EV2 Blank hook');

			expect(step.props.warnings).to.be.a('array');
			expect(step.props.warnings).to.have.all.keys(0);
			expect(step.props.warnings[0]).to.be.a('string');
			expect(step.props.warnings[0]).to.equal('Do not touch the hinged side while closing the MISSE PECs (Pinch Point)');

			expect(step.props.cautions).to.be.a('array');
			expect(step.props.cautions).to.have.all.keys(0);
			expect(step.props.cautions[0]).to.be.a('string');
			expect(step.props.cautions[0]).to.equal('Avoid inadverntent contat with the deployed MISSE PECs, which have shatterable materials, and the silver avionics boxes atop the ExPA');

			expect(step.props.comments).to.be.a('array');
			expect(step.props.comments).to.have.all.keys(0);
			expect(step.props.comments[0]).to.be.a('string');
			expect(step.props.comments[0]).to.equal('this is a comment');

			expect(step.props.notes).to.be.a('array');
			expect(step.props.notes).to.have.all.keys(0);
			expect(step.props.notes[0]).to.be.a('string');
			expect(step.props.notes[0]).to.equal('this is a note');

			expect(step.props.substeps).to.be.a('array');
			expect(step.props.substeps).to.have.all.keys(0);
			expect(step.props.substeps[0]).to.be.a('Object');

			assert.isArray(step.props.substeps[0].props.text);
			assert.strictEqual(step.props.substeps[0].props.text[0], 'select page - RF camera.');

		});
	});

	describe('Normal Input with arrays', () => {

		const yamlString = `
            step: '{{CHECK}} All gates closed & hooks locked'
            title: 'Initial Configuration'
            duration:
                minutes: 5
            checkboxes:
                - '{{CHECKMARK}} R Waist Tether to EV2 Blank hook'
                - second checkbox
            images:
                - ./WVSRecorders.png
                - ./secondImage.png
            substeps:
                - select page - RF camera.
                - step: second substep
            warning:
                - Do not touch the hinged side while closing the MISSE PECs (Pinch Point)
                - second warning
            caution:
                - Avoid inadverntent contat with the deployed MISSE PECs, which have shatterable materials, and the silver avionics boxes atop the ExPA
                - second caution
            comment:
                - this is a comment
                - second comment
            note:
                - this is a note
                - second note
        `;

		const yamlObject = YAML.safeLoad(yamlString);

		it('should return a procedure for normal input', () => {

			const step = new Step(yamlObject, aTask.concurrentSteps[0].subscenes.EV1);

			expect(step).to.exist; // eslint-disable-line no-unused-expressions

			expect(step.props.title).to.be.a('string');
			expect(step.props.title).to.equal('Initial Configuration');

			assert.isArray(step.props.text);
			assert.strictEqual(step.props.text[0], '{{CHECK}} All gates closed & hooks locked');

			expect(step.props.images).to.be.a('array');
			expect(step.props.images).to.have.all.keys(0, 1);
			expect(step.props.images[0]).to.be.a('object');
			expect(step.props.images[0].path).to.be.a('string');
			expect(step.props.images[0].path).to.equal('./WVSRecorders.png');
			expect(step.props.images[1]).to.be.a('object');
			expect(step.props.images[1].path).to.be.a('string');
			expect(step.props.images[1].path).to.equal('./secondImage.png');

			expect(step.props.checkboxes).to.be.a('array');
			expect(step.props.checkboxes).to.have.all.keys(0, 1);
			expect(step.props.checkboxes[0]).to.be.a('string');
			expect(step.props.checkboxes[0]).to.equal('{{CHECKMARK}} R Waist Tether to EV2 Blank hook');
			expect(step.props.checkboxes[1]).to.be.a('string');
			expect(step.props.checkboxes[1]).to.equal('second checkbox');

			expect(step.props.warnings).to.be.a('array');
			expect(step.props.warnings).to.have.all.keys(0, 1);
			expect(step.props.warnings[0]).to.be.a('string');
			expect(step.props.warnings[0]).to.equal('Do not touch the hinged side while closing the MISSE PECs (Pinch Point)');
			expect(step.props.warnings[1]).to.be.a('string');
			expect(step.props.warnings[1]).to.equal('second warning');

			expect(step.props.cautions).to.be.a('array');
			expect(step.props.cautions).to.have.all.keys(0, 1);
			expect(step.props.cautions[0]).to.be.a('string');
			expect(step.props.cautions[0]).to.equal('Avoid inadverntent contat with the deployed MISSE PECs, which have shatterable materials, and the silver avionics boxes atop the ExPA');
			expect(step.props.cautions[1]).to.be.a('string');
			expect(step.props.cautions[1]).to.equal('second caution');

			expect(step.props.comments).to.be.a('array');
			expect(step.props.comments).to.have.all.keys(0, 1);
			expect(step.props.comments[0]).to.be.a('string');
			expect(step.props.comments[0]).to.equal('this is a comment');
			expect(step.props.comments[1]).to.be.a('string');
			expect(step.props.comments[1]).to.equal('second comment');

			expect(step.props.notes).to.be.a('array');
			expect(step.props.notes[0]).to.be.a('string');
			expect(step.props.notes[0]).to.equal('this is a note');
			expect(step.props.notes[1]).to.be.a('string');
			expect(step.props.notes[1]).to.equal('second note');

			expect(step.props.substeps).to.be.a('array');
			expect(step.props.substeps).to.have.all.keys(0, 1);
			expect(step.props.substeps[0]).to.be.a('Object');

			assert.isArray(step.props.substeps[0].props.text);
			assert.strictEqual(step.props.substeps[0].props.text[0], 'select page - RF camera.');
			assert.isObject(step.props.substeps[1]);
			assert.isArray(step.props.substeps[1].props.text);
			assert.strictEqual(step.props.substeps[1].props.text[0], 'second substep');

		});
	});

	describe('getTextFromDefinition()', function() {
		const step = new Step({ warning: 'dummy step' }, aTask.concurrentSteps[0].subscenes.EV1);
		const goodTestCases = [
			{
				input: { step: 'using step key' },
				expected: ['using step key']
			},
			{
				input: { text: 'using text key' },
				expected: ['using text key']
			},
			{
				input: { neither: 'no .text or .step' },
				expected: []
			}
		];

		const erroringTestCases = [
			{ step: 'has .step ...', text: '... and .text' }
		];

		for (const testCase of goodTestCases) {
			it(`should return ${JSON.stringify(testCase.expected)} for input ${JSON.stringify(testCase.input)}`, function() {
				assert.deepStrictEqual(
					step.getTextFromDefinition(testCase.input),
					testCase.expected
				);
			});
		}

		for (const testCase of erroringTestCases) {
			it(`should throw error for ${JSON.stringify(testCase)}`, function() {
				assert.throws(function() {
					step.getTextFromDefinition(testCase.input);
				});
			});

		}
	});

});
