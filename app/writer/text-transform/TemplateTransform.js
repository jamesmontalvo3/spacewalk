'use strict';

// some TemplateTransform class/object
module.exports = class TemplateTransform {

	// ! NOTE: This will likely require modifying splitStringAndTransform() in TextTransform.js

	/**
	 * @param {TextTransform} textTranformer  TextTransform object to be used to properly transform
	 *                                        template arguments.
	 */
	constructor(textTranformer) {
		this.textTranformer = textTranformer;
	}

	/**
	 * Format double braced template string
	 * @param {string} subject
	 * @param {string} templateName    AKA the "function" being used, e.g. "VERIFY"
	 * @param {Function} replacerFn
	 * @return {Object}                Object in form
	 *                                 {
	 *                                   prefix: prefix,            <-- will be transformed later
	 *                                   transformed: transformed,  <-- transformed text
	 *                                   suffix: suffix             <-- will be transformed later
	 *                                 }
	 * @param {boolean} transformArgs  Whether or not to run TextTransform.transform() on args
	 */
	replaceTemplate(subject, templateName, replacerFn, transformArgs = true) {

		// FIXME: are template names required to be alphanumeric+underscores ???
		if (!(/[a-zA-Z\_]+/g).test(templateName)) {
			throw new Error('Find statement does not match regular expression: /[a-zA-Z\_]+/');
		}

		// might want RegExp.exec()...or maybe to run RegExp.test() first
		// Actually not really need regex..just find {{VERIFY then iterate until matching }} found
		const match = subject.match(
			new RegExp('\{\{(?:\\s+)?(' + templateName + ')(?:\\s+)?(\\|\\s{0,}((?!\}\}).)*)\}\}')
		);

		const fullTemplateCall = match[0]; // like "{{VERIFY | some actionYYY}}"
		// match[1] ==> like "VERIFY"
		const args = match[2]; // like "| some actionYYY" FIXME: this only looks for one arg now

		const prefix = subject.substring(0, match.index); // trim everything up to the string

		const preTransformed = somehowGetStringForTemplateCall(); // I made this up for now
		const suffix = match.index + preTransformed.length; // guess

		let templateArgs = preTransformed
			.trim() // remove whitespace from beginning or end. Probably not necessary
			.slice(2, -2) // remove the first two and last two characters, which are {{ and }}
			.trim() // now there probably is whitespace. Remove this.
			.split('|') // break into an array
			.slice(1) // strip off the first part, which is the template name like VERIFY
			.map((text) => {
				return text.trim(); // for each arg, trim off the whitespace...probably want this
			});

		// whether to transform the {{GREEN}} inside {{VERIFY | This text is {{GREEN}} }}
		if (transformArgs && this.textTranformer) {
			templateArgs = templateArgs.map((arg) => {
				return this.textTranformer.transform(arg);
			});
		}

		const transformed = replacerFn(templateArgs);

		return {
			prefix: prefix,
			transformed: transformed,
			suffix: suffix
		};
	}
};
