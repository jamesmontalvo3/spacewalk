'use strict';

const StepModule = require('./StepModule');
const docx = require('docx');

const validSettings = {
	torque: {
		A1: '2.5',
		A2: '3.8',
		A3: '4.8',
		A4: '6.3',
		A5: '7.0',
		A6: '8.3',
		A7: '9.2',
		B1: '12.0',
		B2: '16.0',
		B3: '18.4',
		B4: '19.4',
		B5: '22.0',
		B6: '24.0',
		B7: '25.5'
	},
	speed: {
		CCW3: '60',
		CCW2: '30',
		CCW1: '10',
		CW1: '10',
		CW2: '30',
		CW3: '60'
	},
	mtl: [
		'2.5',
		'5.5',
		'10.5',
		'15.5',
		'23.5',
		'30.5'
	]
};

/**
 * Get array of collar settings (what the collar is turned to), like [B7, CCW2] or [B7, CCW2, 30.5]
 *
 * @param {PgtSet} instance  PgtSet instance
 * @return {Array}
 */
function getCollars(instance) {
	const collars = [instance.torqueCollar, instance.speedCollar];
	if (instance.mtlCollar) {
		collars.push(instance.mtlCollar);
	}
	return collars;
}

/**
 * Get array of collar values, like ["25.5 ft-lbs", "30 RPM", "MTL 30.5"] or
 * ["25.5", "30", "MTL 30.5"]
 *
 * @param {PgtSet} instance  PgtSet instance
 * @param {*} includeUnits   Whether to add units to return values
 * @return {Array}
 */
function getCollarValues(instance, includeUnits = false) {
	const values = [
		validSettings.torque[instance.torqueCollar],
		validSettings.speed[instance.speedCollar],
		'MTL ' + (instance.mtlCollar || instance.mtlDefault)
	];
	if (includeUnits) {
		values[0] += ' ft-lb';
		values[1] += ' RPM';
	}
	return values;
}

/**
 * @param {PgtSet} instance  PgtSet instance
 * @return {string}
 */
function getSetString(instance) {
	return `PGT [${getCollars(instance).join(', ')}]`;
}

/**
 * @param {PgtSet} instance  PgtSet instance
 * @return {string}
 */
function getValueString(instance) {
	let valuesText = `(${getCollarValues(instance, true).join(', ')})`;
	if (instance.socket) {
		valuesText += ` - ${instance.socket}`;
	}
	return valuesText;
}

/**
 * Return `setting` unchanged if it is a valid setting. @throw if not.
 *
 * @param {string} setting  Setting text for given type, e.g. '2.5' to '25.5' for type === 'torque'
 * @param {string} type     torque, speed, mtl
 * @return {string}
 */
function validateSetting(setting, type) {

	// FIXME what's the point of this check? Why just for mtl? This can probably be removed.
	if (type === 'mtl' && !setting) {
		return null;
	}

	let valids;
	if (type === 'mtl') {
		valids = validSettings.mtl;
	} else {
		valids = Object.keys(validSettings[type]);
	}

	if (valids.indexOf(setting) === -1) {
		throw new Error(`Setting ${setting} is not valid for PGT ${type}`);
	}
	return setting;
}

/**
 * Get MTL and socket info, which can be ambiguous based upon user input since they are both
 * optional and thus potentially occupy the third and fourth portions of a pgt.set call (torque and
 * speed are first and second).
 *
 * @param {string|null|undefined} mtlOrSocket   Third part of a pgt.set call, which if not null will
 *                                              be either MTL (if MTL included) or socket info (if
 *                                              socket included but MTL not included)
 * @param {string|null|undefined} socketOrNull  The fourth part of a pgt.set call, if anything.
 * @return {Object}                             Example: { mtl: '30.5', socket: '6-in Wobble' }
 */
function getMtlAndSocket(mtlOrSocket, socketOrNull = null) {
	let mtl,
		socket;
	const mtlMatch = /^\d{1,2}\.\d{1}$/;

	if (mtlOrSocket && mtlMatch.test(mtlOrSocket)) {
		if (validSettings.mtl.indexOf(mtlOrSocket) === -1) {
			throw new Error(`PGT setting ${mtlOrSocket} does not appear to be a valid MTL setting`);
		}
		mtl = mtlOrSocket;
	} else if (mtlOrSocket) {
		socket = mtlOrSocket;
	}
	if (socketOrNull) {
		if (socket) {
			throw new Error(`this.socket already set to ${socket}`);
		}
		socket = socketOrNull;
	}
	return { mtl: mtl, socket: socket };
}

module.exports = class PgtSet extends StepModule {

	constructor(step, stepYaml) {
		super();
		this.key = 'pgt.set';
		this.step = step;

		// todo also accept torque/speed/etc separately (e.g. accept an obj instead of string)
		const inputString = stepYaml[this.key];
		const parts = inputString.split(',').map((val) => {
			return val.trim();
		});

		this.torqueCollar = validateSetting(parts[0], 'torque');
		this.speedCollar = validateSetting(parts[1], 'speed');

		const more = getMtlAndSocket(parts[2], parts[3]);

		this.mtlCollar = validateSetting(more.mtl, 'mtl');
		this.socket = more.socket;
		// this.socket = validateSetting(this.socket, 'socket'); // someday validate sockets???

		this.mtlDefault = '30.5';
	}

	getDefinition() {
		let def = getCollars(this).join(', ');
		if (this.socket) {
			def += `, ${this.socket}`;
		}
		return def;
	}

	alterStepBase() {
		return {
			body: this.formatStepModAlterations(
				'APPEND',
				`${getSetString(this)} ${getValueString(this)}`
			)
		};
	}

	alterStepHtml() {
		return {
			body: this.formatStepModAlterations(
				'APPEND',
				[
					`<strong>${getSetString(this)}</strong>`,
					getValueString(this)
				]
			)
		};
	}

	alterStepDocx() {

		const setPGT = new docx.TextRun({
			text: getSetString(this),
			bold: true
		});

		// Previously had to do this to separate initial pgt.set text from ordinary step.text, but
		// now TaskWriter handles putting newlines between all step body elements. See each
		// (FormatType)TaskWriter.addStepText(). Also no longer have to explicitly add a break
		// between setPgt and pgtValues TextRuns.
		// if (this.step.text.length) { setPGT.break(); }

		const pgtValues = new docx.TextRun({
			text: getValueString(this)
		});

		return {
			body: this.formatStepModAlterations('APPEND', [setPGT, pgtValues])
		};

	}

	alterStepReact() {
		this.setupAlterStepReact();
		return this.doAlterStepReact(getSetString, getValueString);
	}

};
