'use strict';

const arrayHelper = require('../helpers/arrayHelper.js');
const typeHelper = require('../helpers/typeHelper');

/**
 * Overwrites the .actorToColumn object on a ColumnsHandler instance, giving easy access to
 * actor-->column-key relationships
 * @param {ColumnsHandler} columnsHandler  ColumnsHandler instance on which to remap the
 *                                         .actorToColumn property
 */
function remapActorToColumn(columnsHandler) {
	columnsHandler.actorToColumn = {};
	for (const col of columnsHandler.columns) {
		for (const actor of col.actors) {
			columnsHandler.actorToColumn[actor] = col.key;
		}
	}
}

/**
 * Overwrites the .columnToDisplay object on a ColumnsHandler instance, giving easy access to
 * column-key-->column-display relationships
 * @param {ColumnsHandler} columnsHandler  ColumnsHandler instance on which to remap the
 *                                         .columnToDisplay property
 */
function remapColumnKeyToDisplay(columnsHandler) {
	columnsHandler.columnToDisplay = {};

	for (const col of columnsHandler.columns) {
		if (col.display) {
			columnsHandler.columnToDisplay[col.key] = col.display;
		} else {
			columnsHandler.columnToDisplay[col.key] = col.key;
		}
	}
}

/**
 * Re-map all mappings on a ColumnsHandler instance
 * @param {ColumnsHandler} columnsHandler  ColumnsHandler instance on which to perform remappings
 */
function doRemapFunctions(columnsHandler) {
	remapActorToColumn(columnsHandler);
	remapColumnKeyToDisplay(columnsHandler);
}

module.exports = class ColumnsHandler {

	/**
	 *
	 * @param {*} columnsDef  Columns definition from procedure file. Example:
	 *                        [
	 *                          { key: 'IV', actors: "*", display: 'IV/SSRMS/MCC' },
	 *                          { key: 'EV1', actors: ['EV1', 'Someone else'], display: 'EV1' }
	 *                        ]
	 */
	constructor(columnsDef = false, { alwaysShowRoleColumns, alwaysShowWildcardColumn } = {}) {
		// holds columns info
		this.columns = [];

		// holds pointers to info in array for convenience
		this.actorToColumn = {};
		this.columnToDisplay = {};

		this.alwaysShowRoleColumns = alwaysShowRoleColumns || false;

		// store an intent variable, since even if the intent is true, if there is no defined
		// wildcard column then alwaysShowWildcardColumn should be false. Update on update columns.
		this.intendAlwaysShowWildcardColumn = alwaysShowWildcardColumn || false;
		this.alwaysShowWildcardColumn = alwaysShowWildcardColumn || false;

		if (columnsDef) {
			this.updateColumns(columnsDef);
		}
	}

	/**
	 *
	 * @param {Array} newColumnsDefinition  Columns definition from procedure file. See example in
	 *                                      constructor function.
	 */
	updateColumns(newColumnsDefinition) {
		// if shrinking the number of columns, need to throw out any of the columns beyond the
		// length of newColumnsDefinition. Run Array.pop() for each item to be removed. This, rather
		// than slice, is used so this.columns is not reset and any references are preserved.
		const itemsToRemove = this.columns.length - newColumnsDefinition.length;
		for (let i = 0; i < itemsToRemove; i++) {
			this.columns.pop();
		}

		newColumnsDefinition.forEach((colDef, index) => {
			this.updateColumn(index, colDef, false);
		});

		doRemapFunctions(this);

		if (this.intendAlwaysShowWildcardColumn) {
			// if there's a * column, return true, else false
			this.alwaysShowWildcardColumn = !!this.getActorColumnKey('*', true);
		}
	}

	/**
	 *
	 * @param {number} index      Index of column in this.columns array
	 * @param {Object} colDef     Definition of a single column from procedures file. Example:
	 *                              { key: 'IV', display: 'IV/SSRMS/MCC', actors: "*" }
	 * @param {boolean} doRemaps  Whether to rebuild convenience maps like this.actorToColumn. Can
	 *                            choose not to do it here so all columns can have updateColumn()
	 *                            run on them first, then just run the re-maps once afterwards.
	 */
	updateColumn(index, colDef, doRemaps = true) {

		if (!this.columns[index] || typeof this.columns[index] !== 'object') {
			this.columns[index] = {};
		}

		typeHelper.errorIfIsnt(colDef, 'object');
		typeHelper.errorIfIsnt(colDef.key, 'string');
		typeHelper.errorIfIsnt(colDef.actors, 'string', 'array');
		typeHelper.errorIfIsnt(colDef.display, 'falsy', 'string');

		this.columns[index].key = colDef.key;
		this.columns[index].actors = arrayHelper.parseArray(colDef.actors);
		this.columns[index].display = colDef.display ? colDef.display : colDef.key;

		if (doRemaps) {
			doRemapFunctions(this);
		}
	}

	/**
	 * Builds and returns columns definition like that in procedure file
	 * @return {Array}  Columns definition. Example:
	 *                  [
	 *                    { key: 'IV', display: 'IV/SSRMS/MCC', actors: "*" },
	 *                    { key: 'EV1', actors: 'EV1', display: 'EV1' }
	 *                  ]
	 */
	getDefinition() {
		const columnsDefinition = [];
		this.columns.forEach(function(col, i) {
			columnsDefinition[i] = {};
			columnsDefinition[i].key = col.key;
			columnsDefinition[i].actors = col.actors;

			// if display wasn't set in the initial definition, and this function is used to modify
			// the definition, this will set the display to the value of the key.
			columnsDefinition[i].display = col.display;
		});
		return columnsDefinition;
	}

	/**
	 * Get the this.columns[someIndex].key for a given actor. If the actor supplied is not
	 * explicitly specified in any this.columns[someIndex].actors, then it will return column key
	 * for a column with a wildcard actor "*" (or error if no wildcard is specified).
	 *
	 * @param  {string} actor  actor id string
	 * @param {boolean} allowMissing - If true, returns false on missing. If false, throws error on
	 *                                 missing.
	 * @return {string}        key of column (typically also key of primary actor of column), e.g.
	 *                         this.columns[someIndex].key
	 */
	getActorColumnKey(actor, allowMissing = false) {

		/**
		 * this.actorToColumn is in form:
		 *   {
		 *     "*": "IV",
		 *     "EV1": "EV1",
		 *     "EV2": "EV2"
		 *   }
		 * A more complicated form may be:
		 *   {
		 *     "*": "IV",     <-- wildcard to IV column, e.g. getActorColumnKey('anything') --> IV
		 *     "EV1": "EV1",  <-- EV1 actor maps to EV1 column
		 *     "ROBO": "EV1"  <-- ROBO actor maps to EV1 column
		 *   }
		 * In this second example the "ROBO" actor gets mapped to the EV1 column.
		 */
		if (this.actorToColumn[actor]) {
			return this.actorToColumn[actor];
		} else if (this.actorToColumn['*']) {
			return this.actorToColumn['*']; // wildcard for all others
		} else if (allowMissing) {
			return false;
		} else {
			throw new Error(
				`Unknown column for actor ${actor}. Consider adding wildcard * actor to a column`
			);
		}
	}

	/**
	 * @param  {string} actor  actor id string
	 * @return {number}        index of of column object in this.columns
	 */
	getActorColumnIndex(actor) {
		const colKey = this.getActorColumnKey(actor);
		return this.getColumnKeyIndex(colKey);
	}

	/**
	 * Get all values of .key in this.columns[ALL_INDICES].key as an array
	 * @return {Array}  Example: ['column0key', 'column1key', 'column2key']
	 */
	getColumnKeys() {
		return this.columns.map((col) => col.key);
	}

	/**
	 * @param {string} key  key of column (typically also key of primary actor of column), e.g.
	 *                      this.columns[someIndex].key
	 * @return {number}     index of of column object in this.columns
	 */
	getColumnKeyIndex(key) { // was getColumnIndex
		for (let c = 0; c < this.columns.length; c++) {
			if (this.columns[c].key === key) {
				return c;
			}
		}
		throw new Error(`key ${key} not found in columns`);
	}

	/**
	 * @param  {string} actor  actor id string
	 * @return {string}        Display text for the column, e.g. this.columns[someIndex].display
	 */
	getColumnDisplayTextByActor(actor) {
		const colIndex = this.getActorColumnIndex(actor);
		return this.columns[colIndex].display.slice();
	}

	/**
	 * @param {string} colKey  key of column (typically also key of primary actor of column), e.g.
	 *                         this.columns[someIndex].key
	 * @return {string}        Display text for the column, e.g. this.columns[someIndex].display
	 */
	getDisplayTextFromColumnKey(colKey) {
		return this.columnToDisplay[colKey];
	}

	getActors() {
		const actors = [];
		for (const col of this.columns) {
			for (const actor of col.actors) {
				if (actor !== '*') { // don't push wildcard
					actors.push(actor);
				}
			}
		}
		return actors;
	}

};
