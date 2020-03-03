'use strict';

module.exports = class EvaDivisionWriter {

	prepareDivision(division, taskWriter, raw = false, includeEmpty = true) {

		// FIXME see fixme in getSeriesOrder();
		const seriesKeys = division.getSeriesOrder(includeEmpty);

		let colId = 0;
		const columns = {};
		for (const seriesKey of seriesKeys) {

			const colspan = (seriesKey.match(/\+/g) || []).length + 1;
			const colData = {
				colspan,
				children: []
			};

			const seriesModel = division.subscenes[seriesKey];
			let columnKeys = seriesModel ? seriesModel.seriesActors : [seriesKey];
			if (!Array.isArray(columnKeys)) {
				columnKeys = [columnKeys];
			}

			if (raw) {
				colData.stateColumnKey = seriesKey;
				colData.series = seriesModel;
				colData.columnKeys = columnKeys;
			} else {
				const seriesDisplay = seriesModel ?
					taskWriter.writeSeries(seriesModel, columnKeys) : [];

				if (Array.isArray(seriesDisplay)) {
					colData.children.push(...seriesDisplay);
				} else {
					colData.children.push(seriesDisplay);
				}
			}

			columns[colId] = colData;
			colId += colspan;
		}

		return columns;
	}

};
