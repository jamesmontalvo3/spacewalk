'use strict';

const Duration = require('../model/Duration');

/**
Controls the interactivity of the HTML version of a timeline - only runs in the browser
*/

// elements in the overview header
const progressSpan = document.querySelector('span#progress');
const totalDurationSpan = document.querySelector('span#total-duration');
const petSpan = document.querySelector('span#pet');
const timerButton = document.querySelector('button#timer');
const timerSpan = document.querySelector('span#start-stop');

/**
PET timer logic
*/

// used to accomplish the blinking colon effect when the timer is running
let showColon = true;
let petEpoch;
let petPauseTime;
const petLog = [];

/**
 * Outputs either H:M or H:M:S, for use in Duration.format()
 *
 * @param {boolean} showSeconds Whether or not to output seconds
 * @return {string}
 */
function getFormat(showSeconds = true) {
	const colon = showColon ? ':' : ' ';
	const seconds = showSeconds ? `${colon}S` : '';
	return `H${colon}M${seconds}`;
}

/**
 * Convert milliseconds to seconds
 *
 * @param {number} milliseconds
 * @return {number}
 */
function toSeconds(milliseconds) {
	return Math.round(milliseconds / 1000);
}

/**
 * Push msg and milliseconds to `petLog` array and print human readable time and message to console.
 *
 * @param {string} msg
 * @param {number} milliseconds
 */
function logTime(msg, milliseconds) {
	petLog.push({ milliseconds, msg });
	const date = new Date(milliseconds);
	console.log(`At ${date}: ${msg}`);
}

/**
 * Start PET timer at current timestamp
 *
 * @param {boolean} startTime  FIXME: this currently should not be used
 */
function startPET(startTime = false) {
	if (startTime) {
		throw new Error('Setting PET to arbitrary start time not yet implemented');
	}
	petEpoch = Date.now();
	logTime('PET started (epoch set)', petEpoch);
}

/**
 * Pause PET timer, and log the pause event
 */
function pausePET() {
	petPauseTime = Date.now();
	logTime('PET paused', petPauseTime);
}

/**
 * Unpause PET timer, and log the un-pause event
 */
function unpausePET() {
	const pausedForMilliseconds = Date.now() - petPauseTime;

	// adjust PET start time
	petEpoch += pausedForMilliseconds;
	const dur = new Duration({ seconds: toSeconds(pausedForMilliseconds) });
	logTime(`PET unpaused (was paused for ${dur.format('H:M:S')}`, Date.now());
}

/**
 * Get the current PET
 * @param {boolean} showSeconds  Whether or not to display seconds
 * @return {string}              Current PET in HH:MM or HH:MM:SS format
 */
function getPET(showSeconds = true) {
	if (!petEpoch) {
		throw new Error('Cannot get PET because PET timer has not started');
	}
	const secondsSinceEpoch = toSeconds(Date.now() - petEpoch);
	const dur = new Duration({ seconds: secondsSinceEpoch });
	return dur.format(getFormat(showSeconds));
}

// manage the timer itself
const timerInterval = 1000;
let timerRunning = false;
timerButton.onclick = () => {
	timerRunning = !timerRunning;
	if (timerRunning && !petEpoch) {
		startPET();
	} else if (timerRunning) {
		// timer must have been paused
		unpausePET();
	} else if (!timerRunning) {
		// timer had been running, but now it should not be
		pausePET();
	}
	timerSpan.textContent = timerRunning ? 'Pause' : 'Unpause';
	petSpan.textContent = getPET();
	showColon = false;
};

setInterval(() => {
	if (timerRunning) {
		petSpan.textContent = getPET();
		showColon = !showColon;
	}
}, timerInterval);

/**
Initialize timeline info
*/

// const durationMap = new Map();
// const concurrentSteps = document.querySelectorAll('');

// iterate through all steps, use them as a key with a value of the task being used
// then when a step is checked/unchecked, just use the map to determine which task changed

/**
Step click logic
*/

// all the step checkboxes
const stepInputs = document.querySelectorAll('input.step');

/**
 * Sets the overview progress based on the number of checkboxes
 */
function setProgress() {
	let numberCompleted = 0;
	stepInputs.forEach((s) => s.checked && numberCompleted++);

	const status = `${numberCompleted} / ${stepInputs.length}`;
	progressSpan.textContent = status;
}

/**
 * @param {Object} event  Event object
 */
function recordStepClick(event) {
	const timestamp = Date.now();
	console.log(timestamp, event.target.labels[0].textContent);
}

stepInputs.forEach((s) => {
	s.onchange = (event) => {
		setProgress();
		recordStepClick(event);
	};
});

/**
 * Ultimately should do something like the following to get total duration, but instead will just
 * make a guess for now.
 *
 * const actorTotalSeconds = [];
 * for (const actor in maestro.procedure.taskEndpoints) {
 *   actorTotalSeconds.push(
 *     maestro.procWriter.procedure.taskEndpoints[actor].last.actorRolesDict[actor]
 *       .endTime.getTotalSeconds()
 *   );
 * }
 * const totalDuration = new Duration({ seconds: Math.max(...actorTotalSeconds) });
 */

// making guess at total duration for now
const totalDuration = new Duration({ hours: 6, minutes: 30 });
totalDurationSpan.textContent = totalDuration.format('(H:M)');

// initialize the overview header
setProgress();
