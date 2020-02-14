/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;
const YAML = require('js-yaml');

const ConcurrentStep = require('./ConcurrentStep');

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
 * Positive testing for concurrentStep
 */
describe('ConcurrentStep constructor - Positive Testing', function() {
	describe('Normal Input - non-simo', () => {
		const yamlString = `
            EV1:
                - step: "Go Outside"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, aTask);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1.steps).to.exist;
			expect(concurrentStep.subscenes.EV1.steps).to.be.an('array');
			expect(concurrentStep.subscenes.EV1.steps).to.have.all.keys(0);

			assert.isArray(concurrentStep.subscenes.EV1.steps[0].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV1.steps[0].props.text[0], 'Go Outside');
		});
	});

	describe('Role-based Input - non-simo', () => {
		const yamlString = `
            crewA:
                - step: "Go Outside"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, aTask);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1.steps).to.exist;
			expect(concurrentStep.subscenes.EV1.steps).to.be.an('array');
			expect(concurrentStep.subscenes.EV1.steps).to.have.all.keys(0);

			assert.isArray(concurrentStep.subscenes.EV1.steps[0].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV1.steps[0].props.text[0], 'Go Outside');
		});
	});

	describe('Normal Input - simo', () => {
		const yamlString = `
            simo:
                EV1: "Go Outside"
                EV2:
                    - step: "Stay Inside"
                    - step: "Watch EV1"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, aTask);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1.steps).to.exist;
			expect(concurrentStep.subscenes.EV1.steps).to.be.an('array');
			expect(concurrentStep.subscenes.EV1.steps).to.have.all.keys(0);
			assert.isArray(concurrentStep.subscenes.EV1.steps[0].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV1.steps[0].props.text[0], 'Go Outside');

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV2.steps).to.exist;
			expect(concurrentStep.subscenes.EV2.steps).to.be.an('array');
			expect(concurrentStep.subscenes.EV2.steps).to.have.all.keys(0, 1);

			assert.isArray(concurrentStep.subscenes.EV2.steps[0].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV2.steps[0].props.text[0], 'Stay Inside');
			assert.isArray(concurrentStep.subscenes.EV2.steps[1].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV2.steps[1].props.text[0], 'Watch EV1');
		});
	});

	describe('Role-based Input - simo', () => {
		const yamlString = `
            simo:
                crewA: "Go Outside"
                crewB:
                    - step: "Stay Inside"
                    - step: "Watch {{role:crewA}}"
        `;
		var fakeYamlObj = YAML.safeLoad(yamlString);

		it('should return a task for normal input', () => {

			const concurrentStep = new ConcurrentStep(fakeYamlObj, aTask);

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV1.steps).to.exist;
			expect(concurrentStep.subscenes.EV1.steps).to.be.an('array');
			expect(concurrentStep.subscenes.EV1.steps).to.have.all.keys(0);
			assert.isArray(concurrentStep.subscenes.EV1.steps[0].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV1.steps[0].props.text[0], 'Go Outside');

			// eslint-disable-next-line no-unused-expressions
			expect(concurrentStep.subscenes.EV2.steps).to.exist;
			expect(concurrentStep.subscenes.EV2.steps).to.be.an('array');
			expect(concurrentStep.subscenes.EV2.steps).to.have.all.keys(0, 1);
			assert.isArray(concurrentStep.subscenes.EV2.steps[0].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV2.steps[0].props.text[0], 'Stay Inside');
			assert.isArray(concurrentStep.subscenes.EV2.steps[1].props.text);
			assert.strictEqual(concurrentStep.subscenes.EV2.steps[1].props.text[0], 'Watch EV1');
		});
	});
});
