/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

import { assert } from 'chai';
import getSTNTools from './stn';

describe.only('Simple Temporal Networks', () => {
	describe('STN', () => {
		it('should initalize with a reasonable elapsed time', async () => {
			const { STN } = await getSTNTools();
			const stn = new STN();
			assert(stn.toString() === '0 elapsed time');
		});
	});

	describe('Interval', () => {
		it('should initialize with lower, upper bounds', async () => {
			const lower = 1;
			const upper = 2;
			const { Interval } = await getSTNTools();
			const interval = new Interval(lower, upper);
			assert(interval.lower() === lower);
			assert(interval.upper() === upper);
		});
	});
});
