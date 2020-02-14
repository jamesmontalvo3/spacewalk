/* Specify environment to include mocha globals */
/* eslint-env node, mocha */

'use strict';

const assert = require('chai').assert;

const Duration = require('./Duration');

const validInputs = [
	{
		input: { hours: 10, minutes: 59, seconds: 59 },
		expected: {
			hours: 10, minutes: 59, seconds: 59,
			offset: { hours: 0, minutes: 0, seconds: 0 },
			getTotalHours: 10.999722222222221,
			getTotalMinutes: 659.9833333333333,
			getTotalSeconds: 39599,
			toString: '10:59:59',
			sumHereToBottom: 43334,
			subtractHereToBottom: 35864
		}
	},
	{
		input: { seconds: 67 },
		expected: {
			hours: 0, minutes: 1, seconds: 7,
			offset: { hours: 0, minutes: 0, seconds: 0 },
			getTotalHours: 0.01861111111111111,
			getTotalMinutes: 1.1166666666666667,
			getTotalSeconds: 67,
			toString: '00:01:07',
			sumHereToBottom: 3735,
			subtractHereToBottom: -3601
		}
	},
	{
		input: {
			hours: 1, seconds: 67,
			offset: { minutes: 61 }
		},
		expected: {
			hours: 1, minutes: 1, seconds: 7,
			offset: { hours: 1, minutes: 1, seconds: 0 },
			getTotalHours: 1.0186111111111111,
			getTotalMinutes: 61.11666666666667,
			getTotalSeconds: 3667,
			toString: '01:01:07',
			sumHereToBottom: 3668,
			subtractHereToBottom: 3666
		}
	},
	{
		input: {},
		expected: {
			hours: 0, minutes: 0, seconds: 0,
			offset: { hours: 0, minutes: 0, seconds: 0 },
			getTotalHours: 0,
			getTotalMinutes: 0,
			getTotalSeconds: 0,
			toString: '00:00:00',
			sumHereToBottom: 1,
			subtractHereToBottom: -1
		}
	},
	{
		input: { offset: { hours: 1 } },
		expected: {
			hours: 0, minutes: 0, seconds: 0,
			offset: { hours: 1, minutes: 0, seconds: 0 },
			getTotalHours: 0,
			getTotalMinutes: 0,
			getTotalSeconds: 0,
			toString: '00:00:00',
			sumHereToBottom: 1,
			subtractHereToBottom: -1
		}
	},
	{
		input: { seconds: 1 },
		expected: {
			hours: 0, minutes: 0, seconds: 1,
			offset: { hours: 0, minutes: 0, seconds: 0 },
			getTotalHours: 0.0002777777777777778,
			getTotalMinutes: 0.016666666666666666,
			getTotalSeconds: 1,
			toString: '00:00:01',
			sumHereToBottom: 1,
			subtractHereToBottom: 1
		}
	}
];

const durations = [];
for (const test of validInputs) {
	test.durationObject = new Duration(test.input);
	durations.push(test.durationObject); // also create an array of just the duration objects
}

// eslint-disable-next-line require-jsdoc
function testSingle(functionName, description) {
	describe(`${functionName}()`, function() {
		for (const test of validInputs) {
			it(
				`should accurately represent ${description} for input${JSON.stringify(test.input)}`,
				function() {
					assert.equal(test.durationObject[functionName](), test.expected[functionName]);
				}
			);
		}
	});
}

describe('Duration', function() {

	describe('constructor', function() {
		for (const test of validInputs) {
			it(`should set time & offset for input ${JSON.stringify(test.input)}`, function() {
				assert.equal(test.durationObject.hours, test.expected.hours);
				assert.equal(test.durationObject.minutes, test.expected.minutes);
				assert.equal(test.durationObject.seconds, test.expected.seconds);
				assert.equal(test.durationObject.offset.hours, test.expected.offset.hours);
				assert.equal(test.durationObject.offset.minutes, test.expected.offset.minutes);
				assert.equal(test.durationObject.offset.seconds, test.expected.offset.seconds);
			});
		}
	});

	testSingle('getTotalHours', 'float hours');
	testSingle('getTotalMinutes', 'float minutes');
	testSingle('getTotalSeconds', 'float seconds');
	testSingle('toString', 'a standard string');

	describe('format()', function() {
		it('should handle special characters and letters other than H, M, and S', function() {
			assert.equal(
				validInputs[0].durationObject.format('!@#$%^&*()Hqwerty1234[lkjhgfds]:xcvbnm,M:S'),
				'!@#$%^&*()10qwerty1234[lkjhgfds]:xcvbnm,59:59'
			);
		});
	});

	describe('clone()', function() {
		for (const test of validInputs) {
			it(`should create an exact clone for input ${JSON.stringify(test.input)}`, function() {
				const clone = test.durationObject.clone();

				// not the actual same object
				assert.notEqual(clone, test.durationObject);

				// but the same on, like, a deeper level, man
				assert.deepEqual(clone, test.durationObject);
			});
		}
	});

	describe('sum()', function() {
		for (let t = 0; t < validInputs.length; t++) {
			const tToLast = durations.slice(t);
			const timeString = tToLast.map((duration) => {
				return duration.toString();
			}).join(', ');
			it(`should add durations ${timeString}`, function() {
				assert.equal(
					Duration.sum(...tToLast).getTotalSeconds(),
					validInputs[t].expected.sumHereToBottom
				);
			});
		}
	});

	describe('subtract()', function() {
		for (let t = 0; t < validInputs.length; t++) {
			const tToLast = durations.slice(t);
			const timeStrings = tToLast.map((duration) => {
				return duration.toString();
			});

			it(`should subtract ${timeStrings.slice(1).join(', ')} from ${timeStrings[0]}`, function() {
				assert.equal(
					Duration.subtract(...tToLast).getTotalSeconds(),
					validInputs[t].expected.subtractHereToBottom
				);
			});
		}
	});

});
