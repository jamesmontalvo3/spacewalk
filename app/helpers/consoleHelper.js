'use strict';

// note that this is used by adding ".red", ".underline", etc to any string,
// e.g. mystring.red or "some string".underline. As such eslint doesn't detect
// it being used.
const colors = require('colors'); // eslint-disable-line no-unused-vars

/**
 * Create text for console with colors and formatting applied
 *
 * @param {Array|string} messages  Array of messages, or a string which will be converted to array
 * @param {string} title           Text to act as a title over the messages
 * @param {string} color           Font color
 * @param {boolean} addSpacing     If true, add newline before and after output
 * @return {string}
 */
function formatText(messages, title, color, addSpacing) {

	let output = '',
		prefix = '';

	if (typeof messages === 'string') {
		messages = [messages]; // make it an array
	} else if (!Array.isArray(messages)) {
		throw new Error('messages must be string or array');
	}

	if (title && typeof title === 'string') {
		output += title[color].underline;
	} else {
		title = false;
	}

	if (messages.length > 1) {
		prefix = ' - ';
	}

	for (let i = 0; i < messages.length; i++) {
		if (typeof messages[i] !== 'string') {
			messages[i] = `${prefix}var dump:\n${JSON.stringify(messages[i], null, 4)}`[color];
		} else {
			messages[i] = `${prefix}${messages[i]}`[color];
		}
	}

	if (messages.length > 1) {
		if (title) {
			output += '\n';
		}
		output += messages.join('\n');
	} else {
		if (title) {
			output += ': '[color];
		}
		output += messages[0];
	}

	if (addSpacing) {
		output = `\n${output}\n`;
	}

	return output;
}

module.exports = {

	warn: function(messages, title, addSpacing = false) {
		console.error(formatText(messages, title, 'yellow', addSpacing));
	},

	error: function(messages, title) {
		throw new Error(formatText(messages, title, 'red', true));
	},

	noExitError: function(messages, title) {
		console.error(formatText(messages, title, 'red', true));
	},

	success: function(messages, title, addSpacing = false) {
		console.error(formatText(messages, title, 'green', addSpacing));
	}

};
