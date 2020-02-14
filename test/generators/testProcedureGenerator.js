'use strict';

const path = require('path');

const Procedure = require('../../app/model/Procedure');

/**
 *
 * @param {*} procPathFromCases
 * @return {Procedure}
 */
function genProcedure(procPathFromCases) {

	const procedure = new Procedure();
	const procedureFile = path.join(__dirname, '../cases', procPathFromCases);

	const err = procedure.addProcedureDefinitionFromFile(procedureFile);
	if (err) {
		throw new Error(err);
	}

	return procedure;
}

module.exports = genProcedure;
