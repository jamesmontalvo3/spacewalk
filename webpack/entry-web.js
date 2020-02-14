'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const App = require('../app/web/components/App');

/**
 * NOTE: Below is deliberately over-exposing modules for now. This is intended for exploring how
 *       Maestro will be used in browser.
 */
window.maestro = {

	YAML: require('js-yaml'),

	// models
	ColumnsHandler: require('../app/model/ColumnsHandler'),
	ConcurrentStep: require('../app/model/ConcurrentStep'),
	Duration: require('../app/model/Duration'),
	Procedure: require('../app/model/Procedure'),
	Step: require('../app/model/Step'),
	Task: require('../app/model/Task'),
	TaskRole: require('../app/model/TaskRole'),
	TimeSync: require('../app/model/TimeSync'),
	WebProgram: require('../app/model/WebProgram'),

	// Step Modules
	ApfrInstall: require('../app/writer/step-mods/ApfrInstall'),
	PgtSet: require('../app/writer/step-mods/PgtSet'),
	StepModule: require('../app/writer/step-mods/StepModule'),
	stepModules: require('../app/writer/step-mods/stepModules'),

	// helpers
	typeHelper: require('../app/helpers/typeHelper'),
	jsonHelper: require('../app/helpers/jsonHelper'),

	// writers
	EvaHtmlProcedureWriter: require('../app/writer/procedure/EvaHtmlProcedureWriter'),
	HtmlTimelineWriter: require('../app/writer/timeline/HtmlTimelineWriter'),

	// state
	// for now just a lazy way to make a globalish-accessible state container
	// this will get replaced by redux or something at some point, or just made less stupid
	state: require('../app/web/state/index')

};

// require('./app/web/ui/timeline');
const app = <App />;
ReactDOM.render(app, document.getElementById('root'));

window.maestro.app = new window.maestro.WebProgram(window.appComponent);

console.log(`     __  ______    _____________________  ____
    /  |/  /   |  / ____/ ___/_  __/ __ \\/ __ \\
   / /|_/ / /| | / __/  \\__ \\ / / / /_/ / / / /
  / /  / / ___ |/ /___ ___/ // / / _, _/ /_/ /
 /_/  /_/_/  |_/_____//____//_/ /_/ |_|\\____/ v${window.maestro.app.version}`);
