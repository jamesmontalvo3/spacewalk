/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;

const sinon = require('sinon');
const path = require('path');

const fs = require('fs');
const YAML = require('js-yaml');

const Procedure = require('./Procedure');

describe('Procedure', function() {

	const commonExpectations = function(procedure) {
		expect(procedure).to.exist; // eslint-disable-line no-unused-expressions

		expect(procedure.name).to.be.a('string');
		expect(procedure.name).to.equal('Test Procedure 1');

		expect(procedure.tasks).to.be.an('array');
		expect(procedure.tasks).to.have.all.keys(0);

		expect(procedure.tasks[0].title).to.be.a('string');
		expect(procedure.tasks[0].title).to.equal('Egress');

		expect(procedure.tasks[0].rolesDict.crewA.actor).to.equal('EV1');
		expect(procedure.tasks[0].rolesDict.crewA.duration.format('H:M')).to.equal('00:25');

		expect(procedure.tasks[0].concurrentSteps).to.be.an('array');
		expect(procedure.tasks[0].concurrentSteps).to.have.all.keys(0);

		// eslint-disable-next-line no-unused-expressions
		expect(procedure.tasks[0].concurrentSteps[0].subscenes.EV1.steps).to.exist;
		expect(procedure.tasks[0].concurrentSteps[0].subscenes.EV1.steps).to.be.an('array');
		expect(procedure.tasks[0].concurrentSteps[0].subscenes.EV1.steps).to.have.all.keys(0);

		assert.isArray(procedure.tasks[0].concurrentSteps[0].subscenes.EV1.steps[0].props.text);
		assert.strictEqual(
			procedure.tasks[0].concurrentSteps[0].subscenes.EV1.steps[0].props.text[0],
			'Go Outside'
		);
	};

	const procedureDefinition1 = {
		// eslint-disable-next-line camelcase
		procedure_name: 'Test Procedure 1',
		columns: [
			{ key: 'IV', display: 'IV/SSRMS/MCC', actors: '*' },
			{ key: 'EV1', display: 'EV1', actors: 'EV1' },
			{ key: 'EV2', display: 'EV2', actors: 'EV2' }
		],
		tasks: [
			{ file: 'egress.yml', roles: { crewA: 'EV1', crewB: 'EV2' } }
		]
	};

	const egressTaskDefinition = {
		title: 'Egress',
		roles: [
			{ name: 'crewA', description: 'TBD', duration: { minutes: 25 } }
		],
		steps: [
			{ crewA: [{ step: 'Go Outside' }] }
		]
	};

	describe('addProcedureDefinitionFromFile() - positive testing (normal input)', () => {
		const yamlString = `
            procedure_name: Test Procedure 1

            columns:
                - key: IV
                  display: IV/SSRMS/MCC
                  actors: "*"

                - key: EV1
                  actors: EV1
                  display: EV1

                - key: EV2
                  actors: EV2
                  display: EV2

            tasks:
                - file: egress.yml
                  roles:
                    crewA: EV1
                    crewB: EV2
            `;
		const filename = 'foo.yml';

		// not used anywhere, but keeping to make sure yamlString is valid
		try {
			YAML.safeLoad(yamlString);
		} catch (err) {
			throw new Error(err);
		}

		const egressYamlString = `
            title: Egress
            roles:
                - name: crewA
                  description: TBD
                  duration:
                      minutes: 25
            steps:
                - crewA:
                    - step: "Go Outside"
            `;

		// not used anywhere, but keeping to make sure egressYamlString is valid
		try {
			YAML.safeLoad(egressYamlString);
		} catch (err) {
			throw new Error(err);
		}

		// Read some files in for schema checking prior to stubbing the readFileSync method
		const procedureFile = path.join(__dirname, '../schema/procedureSchema.json');
		const taskFile = path.join(__dirname, '../schema/taskSchema.json');
		const procedureSchema = fs.readFileSync(procedureFile, 'utf-8');
		const taskSchema = fs.readFileSync(taskFile);

		//  stub some things
		before(() => {
			const existsSync = sinon.stub(fs, 'existsSync');
			const readFileSync = sinon.stub(fs, 'readFileSync');

			existsSync.withArgs(filename).returns(true);
			readFileSync.withArgs(filename).returns(yamlString);

			existsSync.withArgs(sinon.match('egress.yml')).returns(true);
			readFileSync.withArgs(sinon.match('egress.yml')).returns(egressYamlString);

			readFileSync.withArgs(sinon.match('procedureSchema.json')).returns(procedureSchema);
			readFileSync.withArgs(sinon.match('taskSchema.json')).returns(taskSchema);
		});

		//  restore the stubs
		after(() => {
			sinon.restore();
		});

		it('should return a procedure for normal input', async() => {

			const procedure = new Procedure();

			const err = procedure.addProcedureDefinitionFromFile(filename);

			if (err) {
				console.log(err);
			}
			expect(err).to.not.exist; // eslint-disable-line no-unused-expressions

			commonExpectations(procedure);
		});
	});

	describe('addProcedureDefinitionFromFile() - negative testing (bad input)', () => {

		afterEach(() => {
			sinon.restore();
		});

		// Read some files in for schema checking prior to stubbing the readFileSync method
		const procedureFile = path.join(__dirname, '../schema/procedureSchema.json');
		const taskFile = path.join(__dirname, '../schema/taskSchema.json');
		const procedureSchema = fs.readFileSync(procedureFile, 'utf-8');
		const taskSchema = fs.readFileSync(taskFile);

		it('should throw error if file doesn\'t exist', async() => {

			const procedure = new Procedure();
			const err = procedure.addProcedureDefinitionFromFile('wrong.txt');
			expect(err).to.exist; // eslint-disable-line no-unused-expressions

		});

		it('should throw error if file contains invalid YAML', async() => {

			const filename = 'foo.yml';
			const badYaml = `
                THIS IS NOT YAML.
                `;

			sinon.stub(fs, 'existsSync').withArgs(filename).returns(true);
			const readFileSync = sinon.stub(fs, 'readFileSync');
			readFileSync.withArgs(sinon.match(filename)).returns(badYaml);
			readFileSync.withArgs(sinon.match('procedureSchema.json')).returns(procedureSchema);
			readFileSync.withArgs(sinon.match('taskSchema.json')).returns(taskSchema);

			const procedure = new Procedure();
			const err = procedure.addProcedureDefinitionFromFile(filename);
			expect(err).to.exist; // eslint-disable-line no-unused-expressions

		});

		it('should throw error if yaml is missing procedure_name', async() => {

			const filename = 'foo.yml';
			const yamlString = `

                actors:
                    - role: IV/SSRMS
                    - role: EV1
                      name: Drew
                    - role: EV2
                      name: Taz

                tasks:
                    - file: egress.yml
                    - file: misse7.yml
                `;

			sinon.stub(fs, 'existsSync').withArgs(filename).returns(true);
			const readFileSync = sinon.stub(fs, 'readFileSync');
			readFileSync.withArgs(sinon.match(filename)).returns(yamlString);
			readFileSync.withArgs(sinon.match('procedureSchema.json')).returns(procedureSchema);
			readFileSync.withArgs(sinon.match('taskSchema.json')).returns(taskSchema);

			const procedure = new Procedure();
			const err = procedure.addProcedureDefinitionFromFile(filename);

			/* eslint-disable no-unused-expressions */
			expect(err).to.exist;
			expect(err.validationErrors).to.exist;
			expect(err.validationErrors).to.not.be.empty;
			/* eslint-enable no-unused-expressions */

		});

		it('should throw error if yaml is missing tasks', async() => {
			const filename = 'foo.yml';
			const yamlString = `
                procedure_name: Foo Procedure 1

                actors:
                    - role: IV/SSRMS
                    - role: EV1
                      name: Drew
                    - role: EV2
                      name: Taz

                `;

			sinon.stub(fs, 'existsSync').withArgs(filename).returns(true);
			sinon.stub(fs, 'readFileSync')
				.withArgs(sinon.match(filename, 'utf8')).returns(yamlString);

			const procedure = new Procedure();
			const err = procedure.addProcedureDefinitionFromFile(filename);

			/* eslint-disable no-unused-expressions */
			expect(err).to.exist;
			expect(err.validationErrors).to.exist;
			expect(err.validationErrors).to.not.be.empty;
			/* eslint-enable no-unused-expressions */

		});
	});

	describe('addProcedureDefinition()', function() {

		it('should properly populate the procedure', async() => {

			const procedure = new Procedure();

			const procErr = procedure.addProcedureDefinition(procedureDefinition1);
			if (procErr) {
				console.log(procErr);
			}

			const taskErr = procedure.updateTaskDefinition(
				procedureDefinition1.tasks[0].file,
				egressTaskDefinition
			);

			expect(procErr).to.not.exist; // eslint-disable-line no-unused-expressions
			expect(taskErr).to.not.exist; // eslint-disable-line no-unused-expressions

			commonExpectations(procedure);
		});
	});

	// same as above but wrapping the task definition in an object mapping filename --> definition
	describe('updateTaskDefinitions()', function() {
		it('should properly populate the procedure', async() => {
			const procedure = new Procedure();

			const procErr = procedure.addProcedureDefinition(procedureDefinition1);
			if (procErr) {
				console.log(procErr);
			}

			const taskFileName = procedureDefinition1.tasks[0].file;
			const taskDefinitions = {};
			taskDefinitions[taskFileName] = egressTaskDefinition;

			const taskErr = procedure.updateTaskDefinitions(taskDefinitions);

			expect(procErr).to.not.exist; // eslint-disable-line no-unused-expressions
			expect(taskErr).to.not.exist; // eslint-disable-line no-unused-expressions

			commonExpectations(procedure);
		});
	});
});
