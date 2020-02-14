/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;

const ColumnsHandler = require('./ColumnsHandler');

describe('ColumnsHandler', function() {

	// eslint-disable-next-line require-jsdoc
	function initializeTwoColumns() {
		const ch = new ColumnsHandler();
		const columnsDef = [
			{ key: 'IV', actors: '*', display: 'IV/SSRMS/MCC' }, // note "actors" is string here
			{ key: 'EV1', actors: ['EV1'], display: 'EV1 (Sally)' } // note "actors" is array here
		];
		ch.updateColumns(columnsDef);
		columnsDef[0].actors = ['*']; // in model, converts strings to arrays for actors
		return {
			columnsHandler: ch,
			columnsDef: columnsDef
		};
	}

	describe('constructor', function() {

		it('should initialize columns as empty array when no definition passed', function() {
			const ch = new ColumnsHandler();
			assert.isArray(ch.columns);
			assert.lengthOf(ch.columns, 0);
		});
	});

	describe('updateColumns()', function() {
		it('should initialize columns properly', function() {
			const ch = initializeTwoColumns();
			assert.deepStrictEqual(ch.columnsHandler.columns[0], ch.columnsDef[0]);
			assert.deepStrictEqual(ch.columnsHandler.columns[1], ch.columnsDef[1]);
		});
		it('should update columns properly when increased in size', function() {
			const ch = initializeTwoColumns();
			ch.columnsDef.push({ key: 'EV2', actors: ['EV2'], display: 'EV2' });
			ch.columnsHandler.updateColumns(ch.columnsDef);
			assert.deepStrictEqual(ch.columnsHandler.columns[0], ch.columnsDef[0]);
			assert.deepStrictEqual(ch.columnsHandler.columns[1], ch.columnsDef[1]);
			assert.deepStrictEqual(ch.columnsHandler.columns[2], ch.columnsDef[2]);
		});
		it('should update columns properly when reduced in size', function() {
			const ch = initializeTwoColumns();
			ch.columnsDef.push({ key: 'EV2', actors: ['EV2'], display: 'EV2' });
			ch.columnsHandler.updateColumns(ch.columnsDef);
			ch.columnsDef.pop();
			ch.columnsHandler.updateColumns(ch.columnsDef);
			assert.deepStrictEqual(ch.columnsHandler.columns[0], ch.columnsDef[0]);
			assert.deepStrictEqual(ch.columnsHandler.columns[1], ch.columnsDef[1]);
			assert.lengthOf(ch.columnsHandler.columns, 2);
		});
	});

	// effectively tested by updateColumns()
	// describe('updateColumn()', function() {});

	describe('getDefinition()', function() {
		it('should return a definition identical to the input', function() {
			const ch = initializeTwoColumns();
			assert.deepStrictEqual(ch.columnsHandler.getDefinition(), ch.columnsDef);
		});
	});

	describe('getActorColumnKey()', function() {
		const ch = initializeTwoColumns();
		// console.log(ch.columnsHandler); // --> IV and EV1 column, no EV2 column

		// this passes
		it('should say EV1 is in EV1 column', function() {
			// console.log(ch.columnsHandler); // --> IV, EV1, and magically an EV2 column!?
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('EV1'), 'EV1');
		});

		// this does not pass
		it('should say EV2 is in IV column when EV2 column not yet defined', function() {
			// console.log(ch.columnsHandler); // --> IV, EV1, and magically an EV2 column!?
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('EV2'), 'IV');
		});

		// this passes, despite being "equivolent" to the above
		it('and here\'s a test of ^ those two with initializeTwoColumns() inside it()', function() {
			const ch = initializeTwoColumns();
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('EV1'), 'EV1');
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('EV2'), 'IV');
		});

		it('should say anyone else is in IV column', function() {
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('anyone-else'), 'IV');
		});

		it('should say EV2 is in EV2 column after column added', function() {
			ch.columnsDef.push({ key: 'EV2', actors: ['EV2', 'EV3'], display: 'EV2/EV3' });
			ch.columnsHandler.updateColumns(ch.columnsDef);
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('EV2'), 'EV2');
		});
		it('should say EV3 is in EV2 column due to multiple actors in definition', function() {
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('EV3'), 'EV2');
		});
		it('should still say anyone else is in IV column', function() {
			assert.strictEqual(ch.columnsHandler.getActorColumnKey('ROBO'), 'IV');
		});
	});

	describe('getActorColumnIndex()', function() {
		const ch = initializeTwoColumns();
		it('should properly identify column index', function() {
			assert.strictEqual(ch.columnsHandler.getActorColumnIndex('IV'), 0);
			assert.strictEqual(ch.columnsHandler.getActorColumnIndex('EV1'), 1);
		});
		it('should properly identify column index after updating columns', function() {
			ch.columnsDef.push({ key: 'EV2', actors: ['EV2', 'EV3'], display: 'EV2/EV3' });
			ch.columnsHandler.updateColumns(ch.columnsDef);
			assert.strictEqual(ch.columnsHandler.getActorColumnIndex('IV'), 0);
			assert.strictEqual(ch.columnsHandler.getActorColumnIndex('EV1'), 1);
			assert.strictEqual(ch.columnsHandler.getActorColumnIndex('EV2'), 2);
			assert.strictEqual(ch.columnsHandler.getActorColumnIndex('EV3'), 2);
		});
	});
	describe('getColumnKeys()', function() {
		const ch = initializeTwoColumns();
		it('should get just IV and EV1 initially', function() {
			assert.deepStrictEqual(ch.columnsHandler.getColumnKeys(), ['IV', 'EV1']);
		});
		it('should get EV2, also, after column added', function() {
			ch.columnsDef.push({ key: 'EV2', actors: ['EV2', 'EV3'], display: 'EV2/EV3' });
			ch.columnsHandler.updateColumns(ch.columnsDef);
			assert.deepStrictEqual(ch.columnsHandler.getColumnKeys(), ['IV', 'EV1', 'EV2']);
		});
	});
	describe('getColumnKeyIndex()', function() {
		const ch = initializeTwoColumns();
		it('should properly identify column index by column key', function() {
			assert.strictEqual(ch.columnsHandler.getColumnKeyIndex('IV'), 0);
			assert.strictEqual(ch.columnsHandler.getColumnKeyIndex('EV1'), 1);
		});
		it('should properly identify column index after updating columns by column key', function() {
			ch.columnsDef.push({ key: 'EV2', actors: ['EV2', 'EV3'], display: 'EV2/EV3' });
			ch.columnsHandler.updateColumns(ch.columnsDef);
			assert.strictEqual(ch.columnsHandler.getColumnKeyIndex('IV'), 0);
			assert.strictEqual(ch.columnsHandler.getColumnKeyIndex('EV1'), 1);
			assert.strictEqual(ch.columnsHandler.getColumnKeyIndex('EV2'), 2);
			assert.throws(function() {
				// EV3 is an actor on the EV2 column, not a column itself
				ch.columnsHandler.getColumnKeyIndex('EV3');
			});
		});
	});
	describe('getColumnDisplayTextByActor()', function() {
		const ch = initializeTwoColumns();
		ch.columnsDef.push({ key: 'EV2', actors: ['EV2', 'EV3'], display: 'EV2/EV3' });
		ch.columnsHandler.updateColumns(ch.columnsDef);
		it('should properly get column display text by actor ID', function() {
			assert.strictEqual(ch.columnsHandler.getColumnDisplayTextByActor('IV'), 'IV/SSRMS/MCC');
			assert.strictEqual(ch.columnsHandler.getColumnDisplayTextByActor('EV1'), 'EV1 (Sally)');
			assert.strictEqual(ch.columnsHandler.getColumnDisplayTextByActor('EV2'), 'EV2/EV3');
			assert.strictEqual(ch.columnsHandler.getColumnDisplayTextByActor('EV3'), 'EV2/EV3');
		});
	});
	describe('getDisplayTextFromColumnKey()', function() {
		const ch = initializeTwoColumns();
		ch.columnsDef.push({ key: 'EV2', actors: ['EV2', 'EV3'], display: 'EV2/EV3' });
		ch.columnsHandler.updateColumns(ch.columnsDef);
		it('should properly get column display text by column key', function() {
			assert.strictEqual(ch.columnsHandler.getDisplayTextFromColumnKey('IV'), 'IV/SSRMS/MCC');
			assert.strictEqual(ch.columnsHandler.getDisplayTextFromColumnKey('EV1'), 'EV1 (Sally)');
			assert.strictEqual(ch.columnsHandler.getDisplayTextFromColumnKey('EV2'), 'EV2/EV3');

			// EV3 is an actor on the EV2 column, not a column itself
			assert.isUndefined(ch.columnsHandler.getDisplayTextFromColumnKey('EV3'));
		});
	});

});
