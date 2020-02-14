'use strict';

const consoleHelper = require('../helpers/consoleHelper');

/**
 * Throws an error if not a duration object
 *
 * @param {Duration} duration  Duration object, or throw error if not
 * @return {boolean}           Return true, or throw error
 */
function throwIfNotDuration(duration) {
	if (!(duration instanceof module.exports)) {
		console.error(duration);
		throw new Error('All inputs must be instances of Duration');
	}
	return true;
}

module.exports = class Duration {

	/**
	 * Constructor for Duration
	 * @param {Object} duration  Ex: { minutes: 60, offset: { minutes: 15 } }
	 * @param {bool} useOffset Whether or not to recurse and make a this.offset
	 *                        Duration object.
	 */
	constructor(duration, useOffset = true) {

		// allow creating a zero-time duration
		if (!duration) {
			duration = {};
		}

		const errors = [];
		for (const t of ['hours', 'minutes', 'seconds']) {
			if (typeof duration[t] === 'string') {
				duration[t] = parseInt(duration[t]);
			}

			if (duration[t] && !Number.isInteger(duration[t])) {
				errors.push(`duration ${t} must be an integer`);
			}

			// e.g. set this.hours to duration.hours or zero
			this[t] = duration[t] || 0;
		}
		if (errors.length > 0) {
			consoleHelper.error(errors, 'Duration validation');
		}

		// roll any overflow of seconds into minutes
		if (this.seconds > 59) {
			this.minutes += Math.floor(this.seconds / 60);
			this.seconds = this.seconds % 60;
		}

		// roll any overflow of minutes into hours
		if (this.minutes > 59) {
			this.hours += Math.floor(this.minutes / 60);
			this.minutes = this.minutes % 60;
		}

		// don't set an offset of an offset because (a) that makes no sense and
		// (b) infinite recursion.
		if (useOffset) {
			this.offset = new Duration(duration.offset, false);
		}
	}

	getDefinition() {
		const def = {};
		let propsSet = 0;
		for (const unit of ['hours', 'minutes', 'seconds']) {
			if (this[unit]) {
				def[unit] = this[unit];
				propsSet++;
			}
		}
		const offsetDef = this.offset ? this.offset.getDefinition() : null;
		if (offsetDef) {
			def.offset = offsetDef;
			propsSet++;
		}
		if (propsSet > 0) {
			return def;
		}
		return null;
	}

	getTotalHours() {
		return this.hours + (this.minutes / 60) + (this.seconds / 3600);
	}

	getTotalMinutes() {
		return (this.hours * 60) + this.minutes + (this.seconds / 60);
	}

	getTotalSeconds() {
		return (this.hours * 3600) + (this.minutes * 60) + this.seconds;
	}

	toString() {
		return this.format('H:M:S');
	}

	format(format) {
		// String.padStart requires ES2017 but has a very simple polyfill if we
		// ever want to run this in non-modern browsers
		/* eslint-disable no-restricted-properties */
		return format
			.replace('H', this.hours.toString().padStart(2, '0'))
			.replace('M', this.minutes.toString().padStart(2, '0'))
			.replace('S', this.seconds.toString().padStart(2, '0'));
		/* eslint-enable no-restricted-properties */
	}

	/**
	 * Times change. Sometimes you want a Duration by value not by reference. For example, if you're
	 * getting the duration for an entire procedure by getting the end time of the last task, and
	 * then the last task moves to be the first task, then the full procedure time is WAY off. In
	 * either case (ref or value) the procedure end should be recalculated, but in the interim the
	 * by-value method is likely to have the procedure end time be _more_ correct.
	 *
	 * @return {Duration} Duration object identical to but separate from this Duration object
	 */
	clone() {
		return new Duration({
			seconds: this.getTotalSeconds(),
			offset: { seconds: this.offset.getTotalSeconds() }
		});
	}

	/**
	 * Sum one or more Duration objects and get resulting Duration object.
	 *
	 * @param {...*}  durations  Array of Duration objects to sum
	 * @return {Duration}        Returns a Duration object that is the sum of all inputs
	 */
	static sum(...durations) {
		let totalSeconds = 0;
		for (const d of durations) {
			throwIfNotDuration(d);
			totalSeconds += d.getTotalSeconds();
		}
		return new Duration({ seconds: totalSeconds });
	}

	/**
	 * Subtract Duration objects from first Duration object and get resulting Duration object.
	 *
	 * @param {...*}  durations  Array of Duration objects to subtract
	 * @return {Duration}        Returns a Duration object
	 */
	static subtract(...durations) {
		let totalSeconds = durations.shift().getTotalSeconds();
		for (const d of durations) {
			throwIfNotDuration(d);
			totalSeconds -= d.getTotalSeconds();
		}
		return new Duration({ seconds: totalSeconds });
	}
};
