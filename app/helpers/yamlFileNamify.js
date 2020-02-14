'use strict';

const filenamify = require('filenamify');

module.exports = function(title) {
	return filenamify(title.replace(/\s+/g, '_') + '.yml');
};
