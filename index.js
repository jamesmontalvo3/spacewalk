#!/usr/bin/env node

/**
 * This file contains the command line entry point for Maestro
 */

'use strict';

const maestro = require('./maestro.js');

(function() {
	maestro.run(process.argv);
}());
