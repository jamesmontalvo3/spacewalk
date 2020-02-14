const path = require('path');
const webpack = require('webpack');

// common config between web and electron
const moduleRules = require('./common/module-rules');
const configContext = require('./common/configContext');

module.exports = {

	mode: 'development',

	target: 'web',

	// or --> entry: { editor: 'editor.js', execute: 'execute.js' }
	entry: path.resolve(__dirname, 'entry-web.js'),

	output: {
		path: path.resolve('build/'),

		// If using multiple entry points, do something like this:
		// filename: "[name].bundle.js"
		// filename: "[chunkhash].bundle.js"
		filename: 'bundle.js'
	},

	plugins: [

		// The following modules don't make sense in the browser context. Replace them with dummies
		// or replacements that provide functionality in the browser.
		new webpack.NormalModuleReplacementPlugin(
			/^fs$/,
			path.resolve(__dirname, '../app/web/mocks/fs.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^child_process$/,
			path.resolve(__dirname, '../app/web/mocks/child_process.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^svg2img$/,
			path.resolve(__dirname, '../app/web/mocks/svg2img.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^svgdom$/,
			path.resolve(__dirname, '../app/web/mocks/svgdom.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^.*\/envHelper$/,
			path.resolve(__dirname, '../app/web/mocks/envHelper.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^image-size$/,
			path.resolve(__dirname, '../app/web/mocks/image-size.js')
		)
	],

	context: configContext,

	module: { rules: moduleRules }
};
