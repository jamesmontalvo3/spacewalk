'use strict';

const arrayHelper = require('../../helpers/arrayHelper');
const consoleHelper = require('../../helpers/consoleHelper');

/**
 * Joint actors are in the form of "EV1 + EV2". Getting column indexes and such for these must be
 * done against each of the joined actors.
 * @param {Array} nonJointColumnsInDivision  Array of column text keys used by non-joint columns
 * @param {Array} jointActors                Array like ["IV + EV1", "EV2 + EV3"]
 * @param {TaskWriter} taskWriter            Reference to TaskWriter object for
 * @return {Array}                           Array of "joint actor" objects. Example:
 *                                             [ {
 *                                                  key: 'IV + EV1 + EV3',
 *                                                  array: [ 'IV', 'EV1', 'EV3' ],
 *                                                  columnKeys: [ 'IV', 'EV1', 'EV3' ],
 *                                                  taskColumnIndexes: [ 0, 1, 2 ]
 *                                             } ]
 */
function getJointActorColumnInfo(nonJointColumnsInDivision, jointActors, taskWriter) {

	// for holding not just one set of joint actors, but all of them. So if there were two joins
	// like "EV1 + IV" and "EV2 + SSRMS" we add all of these actors' column keys here
	const allJointActorColumnKeys = [];

	for (let a = 0; a < jointActors.length; a++) {

		const actors = jointActors[a];

		const actorsArr = actors.split('+').map((str) => {
			return str.trim();
		});
		const jointActorColumnKeys = actorsArr.map((act) => {
			return taskWriter.procedure.ColumnsHandler.getActorColumnKey(act);
		});
		const jointActorTaskColumnIndexes = jointActorColumnKeys.map((colKey) => {
			return taskWriter.task.getColumnIndex(colKey);
		}).sort();

		// check if the columns are adjacent
		if (!arrayHelper.allAdjacent(jointActorTaskColumnIndexes)) {
			consoleHelper.error('When joining actors, columns must be adjacent');
		}

		// compute intersect between allJointActorColumnKeys and jointActorColumnKeys
		// then compute against nonJointColumnsInDivision
		const intersect1 = allJointActorColumnKeys.filter(function(n) {
			return jointActorColumnKeys.indexOf(n) > -1;
		});
		const intersect2 = nonJointColumnsInDivision.filter(function(n) {
			return jointActorColumnKeys.indexOf(n) > -1;
		});
		if (intersect1.length > 0 || intersect2.length > 0) {
			intersect1.push(...intersect2);
			consoleHelper.error(
				[
					'For joint actors (e.g. EV1 + EV2), actors cannot be used more than once.',
					`The following actors are used more than once: ${intersect1.toString()}`
				],
				'Joint actors error'
			);
		}
		allJointActorColumnKeys.push(...jointActorColumnKeys);

		// save this for later
		jointActors[a] = {
			key: actors,
			array: actorsArr,
			columnKeys: jointActorColumnKeys,
			taskColumnIndexes: jointActorTaskColumnIndexes
		};
	}

	return jointActors;
}

module.exports = class EvaDivisionWriter {

	/**
	 *
	 * @param {ConcurrentStep} division  ConcurrentStep AKA division object. Looks like:
	 *                                   { actorId: [...steps], actor2id: [...steps] }
	 * @param {TaskWriter} taskWriter
	 * @param {boolean} raw              If true, don't run taskWriter.writeSeries(), just return
	 *                                   the raw data.
	 * @return {Object}                  columns object in the form:
	 *                                   { 0: { colspan: 1, children: [...children] },
	 *                                     1: { colspan: 2, children: [...children] } }
	 *                                   "children" is whatever is outputted by:
	 *                                   taskWriter.writeSeries(), and thus is format-specific (e.g.
	 *                                   docx vs web)
	 */
	prepareDivision(division, taskWriter, raw = false) {

		const columns = {};

		const actorsInDivision = [];
		const columnsInDivision = [];
		const columnIndexesInDivision = [];
		const actorToColumn = {};
		const actorToColumnIndex = {};

		let jointActors = [];

		for (const actor in division.subscenes) {
			if (actor.indexOf('+') === -1) {
				actorsInDivision.push(actor);

				const columnKey = taskWriter.procedure.ColumnsHandler.getActorColumnKey(actor);
				columnsInDivision.push(columnKey);
				actorToColumn[actor] = columnKey;

				const taskColumnIndex = taskWriter.task.getColumnIndex(columnKey);
				columnIndexesInDivision.push(taskColumnIndex);
				actorToColumnIndex[actor] = taskColumnIndex;
			} else {
				jointActors.push(actor);
			}
		}

		jointActors = getJointActorColumnInfo(columnsInDivision, jointActors, taskWriter);

		// merge the merged columns and write the series' to them
		for (const actors of jointActors) {

			const firstCol = actors.taskColumnIndexes[0];
			const lastCol = actors.taskColumnIndexes[actors.taskColumnIndexes.length - 1];

			if (!columns[firstCol]) {
				columns[firstCol] = {
					colspan: lastCol - firstCol + 1,
					children: []
				};
			}

			if (raw) {
				columns[firstCol].stateColumnKey = actors.key;
				columns[firstCol].series = division.subscenes[actors.key];
				columns[firstCol].columnKeys = actors.columnKeys;
			} else {
				const seriesDisplay = taskWriter.writeSeries(
					// get the division info by the key like "EV1 + EV2"
					division.subscenes[actors.key],
					actors.columnKeys
				);
				if (Array.isArray(seriesDisplay)) {
					columns[firstCol].children.push(...seriesDisplay);
				} else {
					columns[firstCol].children.push(seriesDisplay);
				}
			}
		}

		// write series' the normal columns
		for (const actor in actorToColumnIndex) {
			const col = actorToColumnIndex[actor];
			const columnKey = actorToColumn[actor];

			if (!columns[col]) {
				columns[col] = {
					colspan: 1,
					children: []
				};
			}

			if (raw) {
				columns[col].stateColumnKey = columnKey;

				// FIXME shouldn't this be columnKey not actor
				columns[col].series = division.subscenes[actor];
				columns[col].columnKeys = [columnKey];

			} else {
				const seriesDisplay = taskWriter.writeSeries(division.subscenes[actor], columnKey);
				if (Array.isArray(seriesDisplay)) {
					columns[col].children.push(...seriesDisplay);
				} else {
					columns[col].children.push(seriesDisplay);
				}
			}
		}

		return columns;
	}

};
