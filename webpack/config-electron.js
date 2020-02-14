const path = require('path');
const webpack = require('webpack');

// common config between web and electron
const moduleRules = require('./common/module-rules');
const configContext = require('./common/configContext');

module.exports = {

	mode: 'development',

	// https://webpack.js.org/configuration/target/
	target: 'electron-preload',

	// or --> entry: { editor: 'editor.js', execute: 'execute.js' }
	entry: path.resolve(__dirname, 'entry-electron.js'),

	output: {
		path: path.resolve('build/'),

		// If using multiple entry points, do something like this:
		// filename: "[name].bundle.js"
		// filename: "[chunkhash].bundle.js"
		filename: 'electron-bundle.js'
	},

	// Electron does not need to supply the mocks for things like fs, child_process, etc, since it
	// has the full Node.js API.
	// But it doesn't need the node canvas element
	plugins: [
		new webpack.NormalModuleReplacementPlugin(
			/^svg2img$/,
			path.resolve(__dirname, '../app/web/mocks/svg2img.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^svgdom$/,
			path.resolve(__dirname, '../app/web/mocks/svgdom.js')
		)
	],

	context: configContext,
	module: { rules: moduleRules }
};
