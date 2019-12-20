const path = require('path');
const webpack = require('webpack');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

module.exports = {

	mode: 'development',

	target: 'web',

	// or --> entry: { editor: 'editor.js', execute: 'execute.js' }
	entry: './web.js',

	output: {
		path: path.resolve('build/'),

		// If using multiple entry points, do something like this:
		// filename: "[name].bundle.js"
		// filename: "[chunkhash].bundle.js"
		filename: 'bundle.js'
	},

	plugins: [
		// for STNs
		new WasmPackPlugin({
			crateDirectory: path.resolve(__dirname, '.')
		}),
		// The following modules don't make sense in the browser context. Replace them with dummies
		// or replacements that provide functionality in the browser.
		new webpack.NormalModuleReplacementPlugin(
			/^fs$/,
			path.resolve(__dirname, './app/mocks/fs.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^child_process$/,
			path.resolve(__dirname, './app/mocks/child_process.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^.*\/envHelper$/,
			path.resolve(__dirname, './app/mocks/envHelper.js')
		),
		new webpack.NormalModuleReplacementPlugin(
			/^image-size$/,
			path.resolve(__dirname, './app/mocks/image-size.js')
		)
	],

	// The base directory, an absolute path, for resolving entry points and loaders from
	// configuration. By default the current directory is used, but it's recommended to pass a
	// value in your configuration. This makes your configuration independent from CWD (current
	// working directory).
	// context: path.resolve(__dirname, 'src'),

	module: {
		rules: [
			{
				test: /\.m?js$/,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: 'babel-loader'
				}
			},
			{
				test: /\.css$/,
				use: [
					'style-loader',
					{
						loader: 'css-loader',
						options: {
							modules: true
						}
					}
				]
			}
		]

	}
};
