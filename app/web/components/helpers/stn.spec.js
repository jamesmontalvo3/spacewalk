/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

import { assert } from 'chai';
import getSTNTools from './stn';
import all from '../../crate/pkg';

describe.only('Simple Temporal Networks', () => {
	it('should expose an STN class', async() => {
		console.log(all);
		const STN = await getSTNTools();
		// const stn = new STN();
		assert.equal(STN, true, 'STN exists?');
		assert(true === false, 'testing!');
		// assert(stn === 'STN', 'STN class exists');
	});
});
