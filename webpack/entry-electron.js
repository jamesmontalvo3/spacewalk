'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const App = require('../app/web/components/App');
const stepModules = require('../app/writer/step-mods/stepModules');

const app = <App />;
ReactDOM.render(app, document.getElementById('root'));

if (!window.maestro) {
	window.maestro = {};
}

window.maestro.state = require('../app/web/state/index');
window.maestro.reactStepModuleFunctions = {};

for (const mod of stepModules) {
	console.log(`attempting step module react function for ${mod.class}`);
	try {
		window.maestro.reactStepModuleFunctions[`${mod.class}React`] = require(
			`../app/writer/step-mods/${mod.class}React`
		);
		console.log('added');
	} catch (e) {
		console.log(`No React functions for ${mod.key}`);
		console.log(e);
	}
}
