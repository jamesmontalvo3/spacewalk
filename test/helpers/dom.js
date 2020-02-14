'use strict';

const { JSDOM } = require('jsdom');

const { window } = new JSDOM('<!doctype html><html><body></body></html>');

// FIXME: This function and file were added to get React testing working with Mocha. Explanation of
//        what this is doing is required.
// eslint-disable-next-line require-jsdoc
function copyProps(src, target) {
	const props = Object.getOwnPropertyNames(src)
		.filter((prop) => typeof target[prop] === 'undefined')
		.reduce((result, prop) => ({
			...result,
			[prop]: Object.getOwnPropertyDescriptor(src, prop)
		}), {});
	Object.defineProperties(target, props);
}

global.window = window;
global.document = window.document;
global.navigator = {
	userAgent: 'node.js'
};

copyProps(window, global);
