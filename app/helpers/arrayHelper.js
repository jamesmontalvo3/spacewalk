'use strict';

const typeHelper = require('./typeHelper');

/**
 * Parse input as either string or array, and return an array. If the input
 * is a string, return an array with just that string as the single element. If the input has
 * multiple elements, return an array with all strings.
 *
 * @param   {Array|string} stringOrArray  String or array of strings
 * @return  {Array}                       Array of strings
 */
function parseArray(stringOrArray) {

	const array = [];

	if (typeof stringOrArray === 'string') {
		array.push(stringOrArray);

	} else if (Array.isArray(stringOrArray)) {
		array.push(...stringOrArray);

	} else {
		throw new Error(`Expected string or array. Instead got: ${JSON.stringify(stringOrArray)}`);
	}

	return array;
}

/**
 * @param {Array|string} stringOrArray  An array or string to be converted to an array or string
 * @return {Array|string}               If input is a string, just return that string. If input is
 *                                      an array:
 *                                        (1) of length 0  --> return an empty string
 *                                        (2) of length 1  --> return the one element as a string
 *                                        (3) of length >1 --> return the array
 */
function parseToArrayOrString(stringOrArray) {

	if (typeof stringOrArray === 'string') {
		return stringOrArray;

	} else if (Array.isArray(stringOrArray)) {

		// strip any empty strings from the array
		stringOrArray = stringOrArray.filter((value) => {
			return value !== '';
		});

		if (stringOrArray.length === 0) {
			return '';
		} else if (stringOrArray.length === 1) {
			return stringOrArray[0];
		} else {
			return stringOrArray;
		}

	} else {
		throw new Error(`Expected string or array. Instead got: ${JSON.stringify(stringOrArray)}`);
	}

}

/**
 * Determine if all array values (must be integer) are 1 or 0 difference from values before and
 * after.
 * @param  {Array} inputArr Array like [1, 2, 3] (returns true) or [1, 3, 5] (returns false) to
 *                          check for adjacency.
 * @return {boolean}        Whether or not all items are adjacent
 */
function allAdjacent(inputArr) {
	return inputArr.reduce((acc, cur, i, arr) => {
		if (!acc) {
			return false;
		}
		if (i === 0) {
			return true;
		}
		if (Math.abs(cur - arr[i - 1]) > 1) {
			return false;
		} else {
			return true;
		}
	}, true);
}

/**
 * If the length of `arr` is less than `count`, repeat the contents of `arr` until it matches count.
 *
 * @param  {Array} arr     An array to verify is at least `count` long, and repeat the array if not.
 * @param  {integer} count How long the array should be
 * @return {Array}         The lengthened (or kept the same) array
 */
function repeatArray(arr, count) {
	typeHelper.errorIfIsnt(arr, 'array');
	if (arr.length === 0) {
		throw new Error('Array must have at least one element');
	}

	if (arr.length >= count) {
		return [...arr];
	} else {
		const ln = arr.length;
		const b = [];

		for (let i = 0; i < count; i++) {
			b.push(arr[i % ln]);
		}
		return b;
	}
}

/**
 * Check if an item is within an array
 * @param {*} needle        Any item to check for existence in haystack
 * @param {Array} haystack  Array of items to check if needle is within
 * @return {boolean}        Whether or not needle is in haystack
 */
function isAnyOf(needle, haystack) {
	if (haystack.indexOf(needle) === -1) {
		return false; // needle not in array haystack
	} else {
		return true;
	}
}

/**
 * Check if an array is empty. Return false if not an array.
 * @param {Array} check  Array to check
 * @return {boolean}
 */
function isEmptyArray(check) {
	if (!Array.isArray(check)) {
		return false;
	}
	return check.length === 0;
}

module.exports = {
	parseArray,
	parseToArrayOrString,
	allAdjacent,
	repeatArray,
	isAnyOf,
	isEmptyArray
};
