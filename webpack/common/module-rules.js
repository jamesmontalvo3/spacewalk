'use strict';

module.exports = [
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
];
