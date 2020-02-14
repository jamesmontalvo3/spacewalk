'use strict';

const messageToNumber = {
	UNKNOWN: 1,
	EBUSY: 2
};
const numberToMessage = {};

for (const msg in messageToNumber) {
	// create a { 2: "EBUSY" } map
	numberToMessage[messageToNumber[msg]] = msg;
}
module.exports = {
	messageToNumber,
	numberToMessage
};
