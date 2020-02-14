'use strict';

const uuidv4 = require('uuid/v4');

const Step = require('./Step');
const subscriptionHelper = require('../helpers/subscriptionHelper');

module.exports = class Series {

	/**
	 *
	 * @param {Array} seriesActors - Array in form ['EV1'] for a single actor or
	 *                               ['EV1 + EV2', 'EV1', 'EV2'] for a joint actor Series.
	 * @param {ConcurrentStep} parent  ConcurrentStep object containing this series
	 */
	constructor(seriesActors, parent) {
		this.uuid = uuidv4();
		this.subscriberFns = {
			appendStep: [],
			deleteStep: [],
			insertStep: [],
			transferStep: []
		};
		this.setContext(parent);
		this.seriesActors = seriesActors;
		this.steps = [];
	}

	setContext(parent) {
		this.parent = parent;
		this.taskRoles = parent.taskRoles;
		this.indexer = this.parent.parent.procedure.indexer;
	}

	getDefinition() {
		const def = [];
		for (const step of this.steps) {
			def.push(step.getDefinition());
		}
		return def;
	}

	// FIXME this is copied* directly from Step. Create "ReloadableModel" and make them extend it?
	// and that may be a better place than the subscriptionHelper.js file, except that maybe the
	// stateHandler logic needs it, too...?
	//
	// * copied, then refactored since Series has way more subscribable functions
	subscribe(subscriptionMethod, subscriberFn) {
		const unsubscribeFn = subscriptionHelper.subscribe(
			subscriberFn,
			this.subscriberFns[subscriptionMethod]
		);
		return unsubscribeFn;
	}

	modelFromDefOrModel(stepDefOrModel) {
		let stepModel;
		if (stepDefOrModel instanceof Step) { // Ref #121, why able to use 'instanceof' here?
			stepModel = stepDefOrModel;
		} else {
			stepModel = this.makeStep(stepDefOrModel);
		}
		return stepModel;
	}

	/**
	 *
	 * @param {Step|Object|string} stepDefOrModel - Either: (a) Step model to push to this Series,
	 *                                              or (b) plain Object step definition from which
	 *                                              to create a Step model and push to this series.
	 */
	appendStep(stepDefOrModel = false) {
		// console.log('Series.appendStep');
		const stepModel = this.modelFromDefOrModel(stepDefOrModel);
		const last = this.steps[this.steps.length - 1];
		if (last) {
			this.indexer.alter(last.uuid, { nextUuid: stepModel.uuid });
			this.indexer.alter(stepModel.uuid, { prevUuid: last.uuid });
		}
		this.steps.push(stepModel);
		stepModel.setContext(this);
		subscriptionHelper.run(this.subscriberFns.appendStep, this, stepModel);
	}

	deleteStep(stepIndex) {
		// console.log('Series.deleteStep');

		// remove the step from the model
		const [removed] = this.steps.splice(stepIndex, 1);

		// update adjacent records in the index, and remove this record
		const { prevUuid, nextUuid } = this.indexer.delete(removed.uuid);

		// run any subscriptions
		subscriptionHelper.run(this.subscriberFns.deleteStep, this, prevUuid, nextUuid);
	}

	// this uses array splice to insert at the specified index. That will move whatever is at that
	// index to index+1. Thus, this is "insert step before".
	insertStep(insertIndex, stepDefOrModel = false, notify = true) {
		// console.log('Series.insertStep');
		const stepModel = this.modelFromDefOrModel(stepDefOrModel);

		// get indexer references. FIXME this is a pain.
		const targetStep = this.steps[insertIndex];
		if (targetStep) {
			this.indexer.insert(stepModel.uuid, 'before', targetStep.uuid);
		} else {
			const priorStep = this.getStepBefore();
			if (priorStep) {
				this.indexer.insert(stepModel.uuid, 'after', priorStep.uuid);
			} else {
				const nextStep = this.getStepAfter();
				if (nextStep) {
					this.indexer.insert(stepModel.uuid, 'before', nextStep.uuid);
				} else {
					// if no nextStep, and also no priorStep, no update to the index required with
					// regards to other impacted steps. To be sure the inserted step isn't
					// referenced elsewhere, run extract() on it. This may be overkill.
					this.indexer.extract(stepModel.uuid);
				}
			}
		}

		this.steps.splice(insertIndex, 0, stepModel);
		stepModel.setContext(this);
		if (notify) {
			subscriptionHelper.run(this.subscriberFns.insertStep, this, stepModel);
		}
	}

	transferStep(removalIndex, destinationSeries, insertIndex) {
		// console.log('Series.transferStep');
		const [stepToTransfer] = this.steps.splice(removalIndex, 1);

		// transferring step within this Series
		if (destinationSeries === this) {
			console.log('transferring step within series');
			const realInsertIndex = removalIndex < insertIndex ?
				insertIndex :
				insertIndex + 1;

			this.steps.splice(realInsertIndex, 0, stepToTransfer);

		} else {
			console.log('transferring step from one series to another');

			// step was previously in another series which had different actors. Reset.
			stepToTransfer.setActors(destinationSeries.seriesActors);

			// transferring step from this Series to another Series
			// NOTE: indexer updates handled by insertStep()
			destinationSeries.insertStep(insertIndex + 1, stepToTransfer, false); // no notify
			stepToTransfer.setContext(destinationSeries);
		}

		// FIXME is this right name? or should this be registered as an deleteStep? Or both?
		subscriptionHelper.run(
			this.subscriberFns.transferStep,

			// args to subscription functions
			this, // <-- context series for the subscription function
			this, // <-- source series step was transferred from
			removalIndex,
			destinationSeries,
			stepToTransfer
		);
		subscriptionHelper.run(
			destinationSeries.subscriberFns.transferStep,

			// args to subscription functions
			destinationSeries, // <-- context series for the subscription function
			this, // <-- source series step was transferred from
			removalIndex,
			destinationSeries,
			stepToTransfer
		);

	}

	/**
	 * Make a Step based upon the context of this Series. Does not attach the step to the Series.
	 *
	 * @param {Object|string}  stepDefinition
	 * @return {Step}          Resulting step object
	 */
	makeStep(stepDefinition = {}) {
		return new Step(stepDefinition, this); // this.seriesActors, this.taskRoles);
	}

	getStepIndex(step) {
		for (let i = 0; i < this.steps.length; i++) {
			const s = this.steps[i];
			if (s === step) {
				return i;
			}
		}
		throw new Error(`Step ${step.uuid} not within Series ${this.uuid}`);
	}

	getAdjacentSteps(step) {
		for (let i = 0; i < this.steps.length; i++) {
			const s = this.steps[i];
			if (s === step) {
				return { prev: this.steps[i - 1], next: this.steps[i + 1] };
			}
		}
		throw new Error(`Step ${step.uuid} not within Series ${this.uuid}`);

	}

	// NOTE: step number and step index are not directly related. Steps can contain only non-
	// incrementing content like images and NCWs. These do not impact step numbers, but they do
	// count towards indexing.
	getSeriesStepNumber(step) {
		let stepNum = 1;
		for (let i = 0; i < this.steps.length; i++) {
			const s = this.steps[i];
			if (s === step) {
				return stepNum;
			} else {
				stepNum += s.getNumberingImpact();
			}
		}
		throw new Error(`Step ${step.uuid} not within Series ${this.uuid}`);
	}

	getTotalSteps() {
		let totalSteps = 0;
		for (const step of this.steps) {
			totalSteps += step.getNumberingImpact();
		}
		return totalSteps;
	}

	getStepBefore() {
		const { order, index } = this.parent.getSeriesOrderWithIndex(this);

		if (index === 0) {
			// there are no prior serieses, so ask parent for what comes before it
			return this.parent.getStepBefore();
		}

		for (let i = index - 1; i >= 0; i--) {
			const key = order[i];
			const priorSeries = this.parent.subscenes[key];

			if (priorSeries && priorSeries.steps.length > 0) {
				// found steps in this prior series; return the last one
				return priorSeries.steps[priorSeries.steps.length - 1];
			}
		}

		// no steps found in prior serieses, so what comes before parent
		return this.parent.getStepBefore();
	}

	getStepAfter() {
		const { order, index } = this.parent.getSeriesOrderWithIndex(this);

		if (index === order.length - 1) {
			// there are no following serieses, so ask parent for what comes after it
			return this.parent.getStepAfter();
		}

		for (let i = index + 1; i < order.length; i++) {
			const key = order[i];
			const followingSeries = this.parent.subscenes[key];

			if (followingSeries && followingSeries.steps.length > 0) {
				// found steps in this following series; return the first one
				return followingSeries.steps[0];
			}
		}

		// no steps found in following serieses, so what comes after parent
		return this.parent.getStepAfter();
	}

};
