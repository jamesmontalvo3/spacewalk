'use strict';

const TextTransform = require('../text-transform/TextTransform');
const Abstract = require('../../helpers/Abstract');
module.exports = class StepModule extends Abstract {

	constructor() {
		super(['alterStepBase', 'getDefinition']);
		this.VALID_ALTER_TYPES = ['APPEND', 'PREPEND', 'OVERWRITE'];
	}

	getOutputTypeFunctions(outputType) {
		const fns = {
			Base: ['Base'],
			EvaDocx: ['EvaDocx', 'Docx', 'Base'],
			Docx: ['Docx', 'Base'],
			EvaHtml: ['EvaHtml', 'Html', 'Base'],
			Html: ['Html', 'Base'],
			SodfDocx: ['SodfDocx', 'Docx', 'Base'],
			React: ['React', 'Base']
		};
		this.outputTypeFns = fns[outputType] || [];
		return this.outputTypeFns;
	}

	/**
	 * StepModule objects will modify steps. What the StepModule passes to the Step object needs to
	 * be consistent. This handles that consistency.
	 *
	 * @param {string} type           APPEND, PREPEND, or OVERWRITE
	 * @param {string|Array} content  What to add to the content object, if anything
	 * @return {Object}               Examples:
	 *                                  { content: [], type: 'APPEND' }
	 *                                  { content: ['some', 'content'], type: 'PREPEND' }
	 *                                  { content: [docx.TextRun(...)], type: 'OVERWRITE' }
	 */
	formatStepModAlterations(type, content = []) {
		if (this.VALID_ALTER_TYPES.indexOf(type) === -1) {
			throw new Error(
				`Type must be one of: ${this.VALID_ALTER_TYPES.join(', ')}. ${type} given.`
			);
		}

		if (!Array.isArray(content)) {
			content = [content];
		}

		return {
			content: content,
			type: type
		};
	}

	alterStep(outputType) {
		const functions = this.getOutputTypeFunctions(outputType);
		let fn;
		for (const suffix of functions) {
			fn = `alterStep${suffix}`;
			if (this[fn] && typeof this[fn] === 'function') {
				return this[fn]();
			}
		}
		throw new Error(`Output function matching ${fn} not found for ${this.constructor.name}`);
	}

	setupAlterStepReact() {
		// base StepModules (e.g. PgtSet) cannot have their alterStepReact() functions housed in the
		// main file, because alterStepReact() will have JSX and thus isn't valid JS, which
		// displeases the current setup for node. Instead, we bolt on alterStepReact() from another
		// file, {ClassName}React.js (later possibly {ClassName}.react.js).
		if (!this.doAlterStepReact) {

			// Require the {ClassName}React.js file
			const reactStepModuleFunctions = (window && window.isElectron) ?
				window.maestro.reactStepModuleFunctions[`${this.constructor.name}React`] :
				require(`./${this.constructor.name}React`);

			// Add doAlterStepReact() to this instance
			this.doAlterStepReact = reactStepModuleFunctions.doAlterStepReact;

			// Ensure doAlterStepReact() is present on all future instances
			this.constructor.prototype.doAlterStepReact = reactStepModuleFunctions.doAlterStepReact;
		}
	}

	transform(text) {
		if (!this.outputTypeFns) {
			throw new Error('Can\'t call StepModule.transform() until StepModule.getOutputTypeFunctions() called');
		}
		let xformType;
		if (this.outputTypeFns.indexOf('Docx') !== -1) {
			xformType = 'docx';
		} else if (this.outputTypeFns.indexOf('Html') !== -1) {
			xformType = 'html';
		} else if (this.outputTypeFns.indexOf('React') !== -1) {
			xformType = 'react';
		} else {
			xformType = 'text'; // todo not really sure this will work...transforms text to text...
		}
		if (!this.transformer) {
			this.transformer = new TextTransform(xformType);
		}
		return this.transformer.transform(text);
	}

};
