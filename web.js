'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const App = require('./app/components/App');

function consoleVanity(version) {
	console.log(`     __  ______    _____________________  ____
    /  |/  /   |  / ____/ ___/_  __/ __ \\/ __ \\
   / /|_/ / /| | / __/  \\__ \\ / / / /_/ / / / /
  / /  / / ___ |/ /___ ___/ // / / _, _/ /_/ /
 /_/  /_/_/  |_/_____//____//_/ /_/ |_|\\____/ v${version}`);
}

// wasm import is async
// https://webpack.js.org/api/module-methods/#import-1
import('./pkg/').then((m) => {
	m.run();
	return m;
})
	.catch(console.error).then((m) => {
		/**
		 * NOTE: Below is deliberately over-exposing modules for now. This is intended for exploring
		 *       how Maestro will be used in browser.
		 */
		const maestro = {

			YAML: require('js-yaml'),

			// models
			Column: require('./app/model/Column'),
			ConcurrentStep: require('./app/model/ConcurrentStep'),
			Duration: require('./app/model/Duration'),
			Procedure: require('./app/model/Procedure'),
			Step: require('./app/model/Step'),
			Task: require('./app/model/Task'),
			TaskRole: require('./app/model/TaskRole'),
			TimeSync: require('./app/model/TimeSync'),
			WebProgram: require('./app/model/WebProgram'),

			// Step Modules
			ApfrInstall: require('./app/step-mods/ApfrInstall'),
			PgtSet: require('./app/step-mods/PgtSet'),
			StepModule: require('./app/step-mods/StepModule'),
			stepModules: require('./app/step-mods/stepModules'),

			// writers
			EvaHtmlProcedureWriter: require('./app/writer/procedure/EvaHtmlProcedureWriter'),
			HtmlTimelineWriter: require('./app/writer/timeline/HtmlTimelineWriter'),

			// state
			// for now just a lazy way to make a globalish-accessible state container
			// this will get replaced by redux or something at some point, or just made less stupid
			state: require('./app/state/index')

		};

		// require('./app/ui/timeline');

		maestro.app = new maestro.WebProgram();

		window.maestro = maestro;

		// put the stn module on the window for simplicity
		// TODO: would be nice to make this a normal import
		if (m) {
			window.stn = m;
		} else {
			console.error('missing stn module');
		}
		ReactDOM.render(<App />, document.getElementById('root'));

		consoleVanity(maestro.app.version);
	});
