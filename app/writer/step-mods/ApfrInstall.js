'use strict';

const StepModule = require('./StepModule');
const docx = require('docx');

const validSettings = {
	clock: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
	pitch: ['FF', 'GG', 'HH', 'II', 'JJ', 'KK', 'LL', 'MM', 'NN', 'OO', 'PP',
		'QQ', 'RR', 'SS', 'TT', 'UU', 'VV', 'WW', 'XX', 'YY', 'ZZ'],
	roll: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L'],
	yaw: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
};

/**
 * Return `setting` unchanged if it is a valid setting. @throw if not.
 *
 * @param {string} setting  Setting text for given type, e.g. '1' through '12' for type === 'clock'
 * @param {string} type     clock, pitch, roll, or yaw
 * @return {string}
 */
function validateSetting(setting, type) {
	if (validSettings[type].indexOf(setting) === -1) {
		throw new Error(`Setting ${setting} is not valid for APFR ${type} joint`);
	}
	return setting;
}

const specialWIFs = ['SSRMS', 'WIFEX'];

/**
 * Return `wif` unchanged if it matches regular expression or is in array `specialWIFs`
 *
 * @param {string} wif
 * @return {string}
 */
function validateWIF(wif) {
	const standard = /\w+ WIF \d+/;
	if (specialWIFs.indexOf(wif) !== -1 || standard.test(wif)) {
		return wif;
	} else {
		throw new Error(`WIF "${wif}" is not valid. Must be in ${specialWIFs} or match form "<element> WIF <number>"`);
	}
}

/**
 * Get array of settings
 *
 * @param {ApfrInstall} instance  Instance of ApfrInstall object
 * @return {Array}                Array in form [clock, pitch, roll, yaw]
 */
function getSettings(instance) {
	return [instance.clock, instance.pitch, instance.roll, instance.yaw];
}

module.exports = class ApfrInstall extends StepModule {

	constructor(step, stepYaml) {
		super();
		this.key = 'apfr.install';
		this.step = step;

		// todo also accept torque/speed/etc separately (e.g. accept an obj instead of string)
		const settingsString = stepYaml[this.key].settings;

		// strip any [ or ] since people may be used to wrapping settings in brackets,
		// but that isn't necessary anymore
		const parts = settingsString.replace(/\[/g, '').replace(/\]/g, '')
			.split(',')
			.map((val) => {
				return val.trim();
			});

		this.clock = validateSetting(parts[0], 'clock');
		this.pitch = validateSetting(parts[1], 'pitch');
		this.roll = validateSetting(parts[2], 'roll');
		this.yaw = validateSetting(parts[3], 'yaw');

		this.wif = validateWIF(stepYaml[this.key].wif);
	}

	getDefinition() {
		return {
			settings: getSettings(this).join(','),
			wif: this.wif
		};
	}

	alterStepBase() {
		return {
			body: this.formatStepModAlterations(
				'APPEND',
				`Install APFR in ${this.wif} [${getSettings(this).join(',')}]`
			)
		};
	}

	alterStepDocx() {

		const changes = {
			body: this.formatStepModAlterations('APPEND'),
			checkboxes: this.formatStepModAlterations(
				'PREPEND',
				// push some checkboxes onto the front
				[
					'Pull/twist test',
					'Black-on-black',
					'pitch knob locked, can be depressed'
				]
			)
		};

		const installAPFR = new docx.TextRun({
			text: `Install APFR in ${this.wif} `
		});

		if (this.step.props.text.length) {
			// if there is step text, put first APFR text on a new line
			installAPFR.break();
		}
		changes.body.content.push(installAPFR);

		changes.body.content.push(
			new docx.TextRun({
				text: `[${getSettings(this).join(',')}]`,
				bold: true
			})
		);

		return changes;
	}

};
