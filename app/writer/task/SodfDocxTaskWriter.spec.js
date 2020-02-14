/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const path = require('path');
const assert = require('chai').assert;
const docx = require('docx');

const CommanderProgram = require('../../model/CommanderProgram');
const Procedure = require('../../model/Procedure');

const SodfDocxProcedureWriter = require('../procedure/SodfDocxProcedureWriter');
const SodfDocxTaskWriter = require('./SodfDocxTaskWriter');

describe('SodfDocxTaskWriter', function() {
	const procedure = new Procedure();
	const procedureFile = path.join(__dirname, '../../../test/cases/simple/procedures/proc.yml');

	const err = procedure.addProcedureDefinitionFromFile(procedureFile);
	if (err) {
		throw new Error(err);
	}

	const procWriter = new SodfDocxProcedureWriter(new CommanderProgram(), procedure);
	const taskWriter = new SodfDocxTaskWriter(
		procedure.tasks[0],
		procWriter
	);

	describe('#writeDivision', () => {

		it('should create an array of docx.TableRow objects', () => {
			const rows = taskWriter.writeDivision(procedure.tasks[0].concurrentSteps[0]);

			assert.isArray(rows);
			assert.lengthOf(rows, 1);
			assert.instanceOf(rows[0], docx.TableRow);
			assert.instanceOf(rows[0].root[0], docx.TableRowProperties);
			assert.instanceOf(rows[0].root[1], docx.TableCell);
			assert.instanceOf(rows[0].root[1].root[1], docx.Paragraph);
			assert.instanceOf(rows[0].root[1].root[1].root[1], docx.TextRun);
			assert.strictEqual(rows[0].root[1].root[1].root[1].root[1].constructor.name, 'Text');
			assert.strictEqual(rows[0].root[1].root[1].root[1].root[1].root[1], 'EV1');

			// no TextRun in middle TableCell's Paragraph since location is empty string
			assert.isUndefined(rows[0].root[2].root[1].root[1]);

			assert.strictEqual(rows[0].root[3].root[1].root[1].root[1].root[1], 'step 1');
			assert.strictEqual(rows[0].root[3].root[2].root[1].root[1].root[1], 'step 1a');
		});
	});

	describe('#createRow', () => {
		it('should have expected structure', () => {
			const row = taskWriter.createRow(
				'someActor',
				'someLocation',
				[
					new docx.Paragraph('some text'),
					new docx.Paragraph('more text')
				]
			);

			assert.instanceOf(row, docx.TableRow);
			assert.lengthOf(row.root, 4);
			assert.instanceOf(row.root[0], docx.TableRowProperties);
			assert.instanceOf(row.root[1], docx.TableCell);
			assert.instanceOf(row.root[1].root[1], docx.Paragraph);
			assert.instanceOf(row.root[1].root[1].root[1], docx.TextRun);
			assert.strictEqual(row.root[1].root[1].root[1].root[1].constructor.name, 'Text');
			assert.strictEqual(row.root[1].root[1].root[1].root[1].root[1], 'someActor');

			assert.strictEqual(row.root[2].root[1].root[1].root[1].root[1], 'someLocation');

			assert.strictEqual(row.root[3].root[1].root[1].root[1].root[1], 'some text');
			assert.strictEqual(row.root[3].root[2].root[1].root[1].root[1], 'more text');
		});
	});

	describe('#writeSeries', () => {
		it('should add steps in expected structure', () => {
			const task = procedure.tasks[0];

			const doAssertions = (divIndex, actor, stepText, seriesIndex = 0) => {
				const series = task.concurrentSteps[divIndex].subscenes[actor];
				const seriesDisplay = taskWriter.writeSeries(series);

				assert.strictEqual(seriesDisplay[seriesIndex].actor, actor);
				assert.lengthOf(seriesDisplay[seriesIndex].stepParagraphs, 1);
				assert.instanceOf(seriesDisplay[seriesIndex].stepParagraphs[0], docx.Paragraph);
				assert.instanceOf(
					seriesDisplay[seriesIndex].stepParagraphs[0].root[1],
					docx.TextRun
				);
				assert.strictEqual(
					seriesDisplay[seriesIndex].stepParagraphs[0].root[1].root[1].constructor.name,
					'Text' // docx.Text class not exposed
				);
				assert.strictEqual(
					seriesDisplay[seriesIndex].stepParagraphs[0].root[1].root[1].root[1], stepText);
			};

			doAssertions(0, 'EV1', 'step 1');
			doAssertions(0, 'EV1', 'step 1a', 1);
			doAssertions(1, 'EV3', 'step 2');
			doAssertions(2, 'IV', 'step 3');
			doAssertions(3, 'IV', 'step 4');
			doAssertions(3, 'EV1', 'step 5');
			doAssertions(3, 'EV3', 'step 6');
			doAssertions(4, 'IV', 'step 7');
			doAssertions(4, 'EV3', 'step 8');
		});
	});

});
