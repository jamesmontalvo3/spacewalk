'use strict';

const Duration = require('./Duration');

/**
 * For debugging time math
 */
let verbose = false;

/**
 * used by syncActivity() to determine if an activity has been synchronized yet. Reset as required
 * by TimeSync.sync()
 */
let completedSyncActivities = {};

/**
 * Mark a Task as complete with syncActivity()
 * @param {Task} activity Task object to mark as having completed sync
 */
function markSyncComplete(activity) {
	const unique = activity.filename;
	completedSyncActivities[unique] = true;
	if (verbose) {
		console.log(`sync marked complete for ${unique}`);
		console.log(completedSyncActivities);
	}
}

/**
 * Check if syncActivity() still needs to be run on a Task (aka activity)
 * @param {Task} activity  Task object to check if sync is required
 * @return {boolean}       Return true if sync still required, false if not
 */
function syncRequired(activity) {
	if (verbose) {
		console.log(`checking sync required for ${activity.filename}...`);
		console.log(completedSyncActivities);
	}
	return !completedSyncActivities[activity.filename];
}

/**
 * Traverse forward or backward along timeline of tasks by role
 * @param {Task} activity
 * @param {string} role
 * @param {string} direction  'prev' or 'next'. Default is 'next'
 * @param {Function} continueWhileTrueFn
 *                            Keep traversing until this function is false (or enpoint is reached)
 *                            When this function returns false, the last not-false activity is
 *                            returned. To stop on the furthest Task that doesn't require sync, do:
 *                              function(subsequentActivity) {
 *                                  return syncRequired(subsequentActivity);
 *                              }
 * @return {Task}  The Task object found
 */
function traverse(activity, role, direction, continueWhileTrueFn) {
	direction = direction === 'prev' ? 'prevTask' : 'nextTask';
	if (!continueWhileTrueFn) {
		continueWhileTrueFn = function() {
			return true;
		};
	}
	let check = activity;
	while (
		check.actorRolesDict[role][direction] &&
		continueWhileTrueFn(check.actorRolesDict[role][direction])
	) {
		check = check.actorRolesDict[role][direction];
	}
	return check;
}

/**
 * Update start time (and as a result, end time) for a Task. This function mostly traverses forward
 * along Task.actorRolesDict[**each actor**].nextTask, but will traverse along .prevTask when a Task
 * without a startTime is found.
 *
 * @param {Task} activity     Task to update. Recursion will occur for each of this Task's roles, to
 *                            Task.actorRolesDict[actor].nextTask, moving forward in the timeline
 *                            until the end is reached or the `stopAt` Task is found.
 * @param {Task|null} stopAt  Task to stop prior to, or null to continue updating unrestricted
 */
function updateActivityStartTime(activity, stopAt = null) {

	// if traversing only to a point, stop at that point
	if (stopAt && stopAt === activity) {
		return;
	}

	for (const role in activity.actorRolesDict) {

		// previous activity for this role
		const rolePrevAct = activity.actorRolesDict[role].prevTask;

		// this role has an activity prior to this activity
		if (rolePrevAct) {

			// The previous activity does not have a start time. Since we're traversing forward in
			// the timeline, this could only happen if (a) our starting point wasn't at the start or
			// (b) we got to this activity by a chain of one role's activities and we've encountered
			// a new role for a first time, but this isn't that role's first activity. Also there
			// may be (c) where due to race conditions only one role has reached this activity yet.
			// To fix this issue, move backward along this role's timeline until the first activity
			// where the role has a non-null start time OR the role has no prior activities. Then
			// move forward in time updating start times until _this_ activity is reached again.
			if (rolePrevAct.actorRolesDict[role].startTime === null) {

				// traverse backwards until first task for this role, or when a task with
				// a startTime is found return the task without a startTime found prior to it.
				const earliestActivityThatNeedsStartTime = traverse(
					rolePrevAct, role, 'prev',
					function(task) {
						return task.actorRolesDict[role].startTime === null;
					}
				);

				// move forward in time, updating starts, until this activity is reached again
				updateActivityStartTime(
					earliestActivityThatNeedsStartTime, // start on this activity
					activity // progress up to, but not into, this activity
				);
			}

			// _GUESS_ that this activity's start time is the previous' end time.
			// This may not be true since we have not walked backwards in the timeline from this
			// activity verifying each prior activity. That is handled by syncActivity().
			activity.actorRolesDict[role].startTime =
				rolePrevAct.actorRolesDict[role].endTime.clone(); // see Duration.clone() for reason

			// this role does not have an activity prior to this activity
		} else {

			// assume an activity without a prior activity will start at time zero. That should not
			// necessarily be true. At least one role will start at zero, but if the sum of task
			// times between roles is not equal then it is possible one or more roles could
			// start at a time after zero. However, at present this case will still result in all
			// roles starting at zero.
			activity.actorRolesDict[role].startTime = new Duration();

		}

		activity.actorRolesDict[role].endTime = Duration.sum(
			activity.actorRolesDict[role].startTime,
			activity.actorRolesDict[role].duration
		);

	}

	// continue traversing forward in time to next activities
	for (const role in activity.actorRolesDict) {
		const nextTask = activity.actorRolesDict[role].nextTask;
		if (nextTask) {
			updateActivityStartTime(nextTask);
		}
	}

}

/**
 * This function has four phases:
 *
 *  (1) Halt recursion at stopAt if required
 *  (2) Traverse prevTask-graph to sync any un-synced tasks
 *  (3) Sync this activity, aligning all start times with the latest-starting actor
 *  (4) Recurse forward on nextTask-graph
 *
 * The main purpose of this function is (3): to synchronize one activity between the various actors
 * involved. If one actor has 3 hours of activities before this activity, and the other has 1 hour,
 * then this activity must start at 3 hours for both actors. This function does take into account
 * if an offset is defined, e.g. if EV1 has an offet of 15 minutes and EV2 has no offset, then EV1
 * will start 15 minutes later than EV2.
 *
 * @param {Task} activity     Activity to synchronize
 * @param {Task|null} stopAt  Task to stop prior to, or null to continue updating unrestricted
 */
function syncActivity(activity, stopAt = null) {

	// (1) Halt recursion at stopAt
	if (stopAt && stopAt === activity) {
		if (verbose) {
			console.log(`stop syncActivity at ${activity.title}`);
		}
		return;
	}

	// (2) Traverse prevTask-graph to sync any un-synced tasks
	// regardless of whether this is a multi-actor task, _previous_ activities may be multi-actor
	// and may not yet have been synchronized. Sync them first in case they impact this activity.
	for (const role in activity.actorRolesDict) {

		// previous activity for this role
		const rolePrevAct = activity.actorRolesDict[role].prevTask;

		if (rolePrevAct && syncRequired(rolePrevAct)) {
			// traverse backwards until first task for this role, or stop when a task not requiring
			// sync is found, and return the task found before that
			const earliestActivityThatNeedsSync = traverse(
				rolePrevAct, role, 'prev',
				function(previousTask) {
					return syncRequired(previousTask);
				}
			);

			// move forward in time, updating starts, until this activity is reached again
			syncActivity(earliestActivityThatNeedsSync, activity);
		}
	}

	// (3) Sync this activity, aligning all start times with the latest-starting actor
	const roles = Object.keys(activity.actorRolesDict);
	const normalized = {};
	let maxNormalized = new Duration();
	const updated = {};

	/**
	 * Don't syncActivity if (a) it has already been synced or (b) it has only one role, because:
	 *   (a) Doesn't need to be synced twice
	 *   (b) Start time for single-role activities will be solely based upon the end time of the
	 *       previous activity, and thus cannot be shifted due to synchronizing with another actor.
	 */
	if (syncRequired(activity) && roles.length > 1) {
		if (verbose) {
			console.log(`syncing... ${activity.title}`);
		}

		for (const role in activity.actorRolesDict) {
			// normalized start is a role's start time for an activity minus the offset. This makes
			// it possible to compare two or more roles' start times for the same activity.
			normalized[role] = Duration.subtract(
				activity.actorRolesDict[role].startTime,
				activity.actorRolesDict[role].duration.offset
			);

			if (normalized[role].getTotalSeconds() > maxNormalized.getTotalSeconds()) {
				maxNormalized = normalized[role];
			}
		}

		for (const role in normalized) {
			if (normalized[role].getTotalSeconds() !== maxNormalized.getTotalSeconds()) {

				// get new, de-normalized, start time
				activity.actorRolesDict[role].startTime = Duration.sum(
					maxNormalized,
					activity.actorRolesDict[role].duration.offset
				);

				activity.actorRolesDict[role].endTime = Duration.sum(
					activity.actorRolesDict[role].startTime,
					activity.actorRolesDict[role].duration
				);

				// mark this one updated
				updated[role] = true;
			}
		}

		for (const role in updated) {

			// remove in production, useful for dev.
			if (verbose) {
				console.log(`${activity.title} start time changed to ${activity.actorRolesDict[role].startTime} for role ${role}`);
			}

			// push the start time change forward to all following events
			if (activity.actorRolesDict[role].nextTask) {
				updateActivityStartTime(activity.actorRolesDict[role].nextTask);
			}

		}

	} else if (verbose) {
		let msg = `skipping sync on ${activity.title} because:`;
		if (!syncRequired(activity)) {
			msg += ' sync marked complete,';
		}
		if (roles.length < 2) {
			msg += ` ${roles.length} roles`;
		}
		console.log(msg);
	}

	// don't re-run this on any subsequent passes
	markSyncComplete(activity);

	// (4) Recurse forward on nextTask-graph
	// regardless of whether this was a multi-actor task, subsequent tasks may be. Sync them.
	for (const role in activity.actorRolesDict) {
		const nextTask = activity.actorRolesDict[role].nextTask;
		if (nextTask && syncRequired(nextTask)) {
			syncActivity(nextTask);
		}
	}

}

module.exports = class TimeSync {

	/**
	 * TimeSync...because time math is hard
	 * @param {...Task} tasks           Array of Task objects to synchronize
	 * @param {boolean} beVerbose       Set to true when the only prescription is more debug
	 * @param {boolean} initStartTimes  Set to false to not do an initial run of updateStartTimes().
	 *                                  This is intended for testing only, to verify that the first
	 *                                  task passed into updateStartTimes() does not impact result.
	 */
	constructor(tasks, beVerbose = false, initStartTimes = true) {
		this.tasks = tasks;
		this.updateStartTimesRequired = true;
		if (beVerbose) {
			verbose = true;
		}
		if (initStartTimes) {
			updateActivityStartTime(this.tasks[0]);
		}
	}

	/**
	 * Blindly update start times. Requires sync() to gaurantee accuracy. See docs for
	 * updateActivityStartTime().
	 *
	 * @param {Task|null} task  Optionally specify task to start update on. Defaults to first task
	 *                          in this.tasks
	 */
	updateStartTimes(task) {

		// May want to specify starting point. See sync().
		if (!task) {
			task = this.tasks[0];
		}

		// Will traverse graph doing a rough estimate of start times, without considering how tasks
		// may need to be synchronized between actors (i.e. actors need to start joint tasks at the
		// same time)
		updateActivityStartTime(task);
		this.updateStartTimesRequired = false;
	}

	/**
	 * Synchronize tasks. See docs for syncActivity().
	 *
	 * @param {Task|null} task  Optionally specify task to start sync on. Defaults to first task in
	 *                          this.tasks
	 */
	sync(task) {

		// allow specifying a starting point. syncActivity() will walk forward/backward on the
		// directed acyclic graphs created by the .nextTask and .prevTask properties. If improperly
		// implemented, it could be possible that results are starting-point dependent. Allow
		// starting point to be set to test against this. ALSO, at some point we may want to be able
		// to target updates to specific parts of the graph.
		if (!task) {
			task = this.tasks[0];
		}

		if (this.updateStartTimesRequired) {
			this.updateStartTimes(task);
		}

		// Clear the syncComplete object
		completedSyncActivities = {};

		// this will sync the specified activity, and will traverse the nextTask/prevTask graphs as
		// required to hit all activities...or will it. A sufficiently complicated graph could have
		// portions which are not always reached. Or a disconnected graph DEFINITELY would have
		// unreachable portions.
		syncActivity(task);
	}

	/**
	 * Return a text representation of the timeline, mostly for test/debug purposes
	 *
	 * @param {...Task} tasks  Array of Task objects
	 * @return {string}        String representation of timeline like:
	 *   FIRST TASK
	 *     EV1: 00:00 + 00:45 = 00:45
	 *     EV2: 00:00 + 00:30 = 00:30  <-- note EV2 duration is shorter, so end time is earlier
	 *   SECOND TASK
	 *     EV1: 00:45 + 00:30 = 01:15
	 *     EV2: 00:45 + 00:30 = 01:15  <-- SECOND specifies EV1 & 2 start same time (EV2 15min wait)
	 *   THIRD TASK
	 *     EV1: 01:15 + 01:10 = 02:25
	 *     EV2: 01:15 + 01:15 = 02:30
	 */
	toString() {
		const tasks = this.tasks;
		let output = '';
		for (const task in tasks) {
			output += tasks[task].title + '\n';

			for (const role in tasks[task].actorRolesDict) {
				const start = tasks[task].actorRolesDict[role].startTime.format('H:M');
				const duration = tasks[task].actorRolesDict[role].duration.format('H:M');
				const end = tasks[task].actorRolesDict[role].endTime.format('H:M');
				output += `  ${role}: ${start} + ${duration} = ${end}\n`;
			}
		}
		return output;
	}

	/**
	 * Function to collect all present actors, and point to their first and last task by traversing
	 * the timeline forward and backward to endpoints.
	 *
	 * @param {...Task} tasks
	 * @return {Object}        Object like:
	 *   {
	 *     EV1: {
	 *       first: First task performed by EV1,
	 *       last: Final task performed by EV1
	 *     },
	 *     EV2: { ...same format as EV1... }
	 *   }
	 */
	endpoints() {
		const presentActors = {};
		for (const task of this.tasks) {
			for (const actor in task.actorRolesDict) {
				if (!presentActors[actor]) {
					presentActors[actor] = {
						first: traverse(task, actor, 'prev'),
						last: traverse(task, actor, 'next')
					};
				}
			}
		}
		return presentActors;
	}

	/**
	 * @return {Object}  Object with nodes and edges, in form:
	 *                   const data = {
	 *                     nodes: [
	 *                       { id: 0, label: "some label" }, { id: 1, ... }, ...
	 *                     ],
 	 *                     links: [
	 *                       { source: 0, target: 2, minutes: 25, action: "some text" },
	 *                       { source: 1, ... }, ...
	 *                     ]
	 *                   };
	 */
	getStnGraph() {

		// each task will have a node for _each actor on the task_
		const nodes = [];
		const edges = [];

		const actorEndpoints = {};

		const taskToIndexMap = new Map(); // for a given task get its 'nodes' indices for each actor
		this.tasks.forEach((task) => {
			const actorToNode = {};
			for (const actor in task.actorRolesDict) {
				const nodeId = nodes.length;
				nodes.push({ id: nodeId, label: `Start of ${task.title} for ${actor}` });
				actorToNode[actor] = nodeId; // for looking up nodes easily
			}
			taskToIndexMap.set(task, actorToNode);
		});

		this.tasks.forEach((task) => {

			// if more than one actor on this task, we will need to establish sync requirements
			// between their task-actor-nodes. Establish this boolean once here.
			const allActors = Object.keys(task.actorRolesDict);
			const addSyncEdges = allActors.length > 0;

			// we'll be removing actors from this as we progress through. Start with all of them.
			let otherActors = allActors.slice();

			for (const actor in task.actorRolesDict) {

				// remove actor from otherActors
				otherActors = otherActors.splice(otherActors.indexOf(actor), 1);

				const nextTask = task.actorRolesDict[actor].nextTask;
				let target;
				if (nextTask) {
					target = taskToIndexMap.get(nextTask)[actor];
				} else {
					const nodeId = nodes.length;
					nodes.push({ id: nodeId, label: `End of procedure for ${actor}` });
					target = nodeId;
					actorEndpoints[actor] = target;
				}
				edges.push({
					source: taskToIndexMap.get(task)[actor],
					target: target,
					minutes: task.actorRolesDict[actor].duration.getTotalMinutes(),
					action: `${actor} performing ${task.title}`
				});

				if (addSyncEdges) {

					for (const otherActor of otherActors) {
						edges.push({
							source: taskToIndexMap.get(task)[otherActor],
							target: taskToIndexMap.get(task)[actor],

							minutes: Duration.subtract(
								task.actorRolesDict[actor].duration.offset,
								task.actorRolesDict[otherActor].duration.offset
							).getTotalMinutes(),
							action: `${actor} --> ${otherActor} sync offset for ${task.title}`
						});
					}
				}
			}

		});

		let otherActors = Object.keys(actorEndpoints).slice();

		for (const actor in actorEndpoints) {
			otherActors = otherActors.splice(otherActors.indexOf(actor), 1);

			for (const otherActor of otherActors) {
				edges.push({
					source: actorEndpoints[actor],
					target: actorEndpoints[otherActor],

					// FIXME: For simplicity, just assuming everyone ends at the same time. For all
					// planned procedures this is currently true, but this should be generalized for
					// cases that may include this.
					minutes: 0,
					action: `${actor} --> ${otherActor} sync offset for procedure end`
				});
			}
		}

		return { nodes, edges };
	}
};
