/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const path = require('path');
const assert = require('chai').assert;
// const PNG = require('pngjs').PNG; // attempted to use for PNG checking. See writePNG() below.

const Procedure = require('../../app/model/Procedure');

/**
 * Get a Procedure object from a file path
 *
 * @todo this should potentially be a static function in the Procedure class
 *
 * @param {string} filepath  File path to procedure file
 * @return {Procedure}
 */
function createProcedure(filepath) {
	const procedure = new Procedure();
	const err = procedure.addProcedureDefinitionFromFile(filepath);
	if (err) {
		throw new Error(err);
	}
	return procedure;
}

module.exports = class TimelineWriterTester {

	constructor(TimelineWriterClass) {

		this.TimelineWriterClass = TimelineWriterClass;
		this.tests = [
			{
				file: 'cases/simple/procedures/proc.yml',
				expected: {
					columns: ['EV1', 'EV3'],
					actorToTimelineColumn: { EV1: 0, EV3: 1 },
					minutesToPixels: {
						0: [0, 0],
						30.5: [640, 640.5],
						59.123: [1241, 1241.5829999999999],
						97: [2037, 2037],
						120.123: [2522, 2522.583]
					}
				}
			},
			{
				file: 'cases/complex-times/procedures/proc.yml',
				expected: {
					columns: ['EV1', 'EV2', 'EV3', 'EV4'],
					actorToTimelineColumn: { EV1: 0, EV2: 1, EV3: 2, EV4: 3 },
					minutesToPixels: {
						0: [0, 0],
						31: [43, 43.4],
						59: [82, 82.6],
						90: [125, 125.99999999999999], // note possibly bad rounding here
						123: [172, 172.2],
						151: [211, 211.39999999999998]
					}
				}
			}
		];

	}

	setup(testInstance) {
		const filepath = path.join(__dirname, '..', testInstance.file);

		const out = {};
		// create the procedure associated with this file
		out.procedure = createProcedure(filepath);

		// Create Procedure.toJSON() to handle circular refs, then use it to determine
		// idempotency here...create it again, for use in idempotency tests
		// testInstance.expected.untouchedProcedure = createProcedure(testInstance.file);

		out.timeline = new this.TimelineWriterClass(out.procedure);

		out.buildDir = path.join(filepath, '../../build');

		return out;
	}

	testCreate() {
		for (const testInstance of this.tests) {
			const { timeline } = this.setup(testInstance);

			const first = timeline.create();

			it(`should return a string of non-trivial length for ${testInstance.file}`, function() {
				assert.isString(first);
				assert.isAtLeast(first.length, 20);
			});

			const second = timeline.create();

			it(`should be idempotent for ${testInstance.file}`, function() {
				assert.equal(first, second);
			});
		}
	}

};
