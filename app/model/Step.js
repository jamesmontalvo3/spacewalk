'use strict';

const cloneDeep = require('lodash/cloneDeep');
const uuidv4 = require('uuid/v4');

const subscriptionHelper = require('../helpers/subscriptionHelper');
const arrayHelper = require('../helpers/arrayHelper');
const consoleHelper = require('../helpers/consoleHelper');
const stepModules = require('../writer/step-mods/stepModules');
const Duration = require('./Duration');

const loadedModules = {};

const props = {
	strings: ['title'],
	arrays: ['checkboxes', 'warnings', 'cautions', 'comments', 'notes']
};

module.exports = class Step {

	/**
	 *
	 * @param {Object} definition            Object with anything that can be within a step, like:
	 *                                     { text: "Things!", title: "Stuff!", checkboxes: [], ... }
	 * @param {Series} parent - Series to point to as parent ~~or null if no parent~~ fixme. In the
	 *                               future substeps may point to something other than a Series as
	 *                               their parent (either the parent Step, or something else).
	 */
	constructor(definition, parent) { // actorIdOrIds, taskRoles) {
		this.uuid = uuidv4();
		this.context = {};
		this.props = {};
		this.reloadSubscriberFns = []; // these can't be wiped out...FIXME keep pondering this
		this.subscriberFns = {
			reload: [],
			trigger: []
		};

		this.setContext(parent, definition);
		this.setState(definition);
		this.getRootSeries().parent.parent.procedure.indexer.add(this);
	}

	/**
	 * @param {Series|null} parent - Series to point to as parent, or null if no parent. In the
	 *                               future substeps may point to something other than a Series as
	 *                               their parent (either the parent Step, or something else).
	 * @param {Object} definition FIXME docs
	 */
	setContext(parent, definition) {
		this.parent = parent;

		// this needs to be re-run if a step is moved between _activities_
		// sets this.context.taskRoles & this.context.taskRolesMap
		this.mapTaskRolesToActor(parent.taskRoles);

		// this needs to be re-run if a step is moved between actors/roles/columns
		this.setActors(
			parent.seriesActors,
			definition // was definition.actor
		);
	}

	// FIXME this is copied* directly from Series. Create "ReloadableModel" and make them extend it?
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

	// FIXME this should probably be broken up into separate external use of setState and setContext
	reload(newDefinition = {}, parent = this.parent) {
		this.setContext(parent, newDefinition);
		this.setState(newDefinition);
		const { prev, next } = this.getAdjacentActivitySteps();
		this.props.prevUuid = prev ? prev.uuid : null;
		this.props.nextUuid = next ? next.uuid : null;
		subscriptionHelper.run(this.subscriberFns.reload, this);
	}

	trigger() {
		subscriptionHelper.run(this.subscriberFns.trigger, this);
	}

	getDefinition() {
		// FIXME need to output location

		const def = {};

		for (const prop of props.strings) {
			if (this.props[prop]) {
				def[prop] = this.props[prop];
			}
		}

		// Currently YAML "step" prop maps to model "text" prop. See comment in constructor.
		if (this.props.text.length > 1) {
			def.text = this.props.text.slice(); // copy the array
		} else if (this.props.text.length === 1) {
			def.text = this.props.text[0];
		}

		if (this.props.images.length) {
			def.images = cloneDeep(this.props.images);
		}

		for (const prop of props.arrays) {
			const parsedValue = arrayHelper.parseToArrayOrString(this.props[prop].slice());
			if (parsedValue !== '' && !arrayHelper.isEmptyArray(parsedValue)) {
				def[prop] = parsedValue;
			}
		}

		if (!arrayHelper.isEmptyArray(this.props.substeps)) {
			def.substeps = this.props.substeps.map((substep) => {
				return substep.getDefinition();
			});
		}

		for (const module of this.props.modules) {
			def[module.key] = module.getDefinition();
		}

		const durationDef = this.props.duration ? this.props.duration.getDefinition() : false;
		if (durationDef) {
			def.duration = durationDef;
		}

		if (this.props.definitionActor) {
			def.actor = this.props.definitionActor;
		}

		if (this.props.definitionLocation) {
			def.location = this.props.definitionLocation;
		}

		return def;
	}

	getTextFromDefinition(stepYaml) {
		if (stepYaml.step || stepYaml.text) {
			if (stepYaml.step && stepYaml.text) {
				throw new Error(
					'The "step" property is deprecated, and "text" is preferred, but both cannot be set'
				);
			}
			const content = stepYaml.text ? stepYaml.text : stepYaml.step;
			const preStep = arrayHelper.parseArray(content);
			return preStep.map((text) => this.parseStepText(text));
		}
		return [];
	}

	setState(definition) {

		this.props = {}; // wipes out pre-existing properties, so reload() can start over

		this.props.definitionActor = definition.actor;
		this.props.definitionLocation = definition.location;

		// Initiate the vars as empty.
		for (const prop of props.strings) {
			this.props[prop] = '';
		}

		// FIXME: This can't be in props.strings because the YAML input is "step" not "text", and in
		// getDefinition() it needs the proper YAML input name. Ultimately probably should change
		// "step" to "text".
		this.props.text = [];

		for (const prop of props.arrays) {
			this.props[prop] = [];
		}

		// handled differently by getDefinition()
		this.props.images = [];
		this.props.modules = [];
		this.props.substeps = [];

		// Check if the step is a simple string
		if (typeof definition === 'string') {
			this.props.text = [this.parseStepText(definition)];
			return;
		}

		this.props.duration = new Duration(definition.duration);

		// Check for the title
		if (definition.title) {
			this.props.title = this.parseTitle(definition.title);
		}

		// Check for the text
		this.props.text = this.getTextFromDefinition(definition);

		// Check for images
		if (definition.images) {
			this.props.images = arrayHelper.parseArray(definition.images);

			for (let i = 0; i < this.props.images.length; i++) {
				if (typeof this.props.images[i] === 'string') {
					this.props.images[i] = { path: this.props.images[i] };
				}
				const image = this.props.images[i];

				if (image.width && !Number.isInteger(image.width) && image.width < 1) {
					throw new Error(`Width should be empty or a positive integer: ${image.path}`);
				}
				if (image.height && !Number.isInteger(image.height) && image.height < 1) {
					throw new Error(`Height should be empty or a positive integer: ${image.path}`);
				}
			}
		}

		const blocks = {
			// yaml prop    internal prop
			checkboxes: 'checkboxes',
			warning: 'warnings',
			caution: 'cautions',
			note: 'notes',
			comment: 'comments'
		};
		for (const yamlKey in blocks) {
			// user-generated YAML has different property names than internal JS property names
			const jsKey = blocks[yamlKey];
			const singularValue = this.parseBlock(definition[yamlKey]);
			const pluralValue = this.parseBlock(definition[jsKey]);
			this.props[jsKey] = singularValue.length ? singularValue : pluralValue;
		}

		// Check for substeps
		if (definition.substeps) {
			this.props.substeps = this.parseSubsteps(definition.substeps);
		}

		for (const module of stepModules) {
			if (definition[module.key]) {
				if (!loadedModules[module.key]) {
					loadedModules[module.key] = require(`../writer/step-mods/${module.class}`);
				}

				// todo for any modules already in this.modules:
				// todo (1) add suggestions for modules to use along with this (module.suggest)
				// todo ... probably aggregate a list of suggestions, and after all modules loaded
				// todo ... then you can check that list against all modules
				// todo (2) add Errors for any module.reject
				// todo (3) add warnings for modules in neither module.suggest nor module.reject

				// instantiate StepModule
				this.props.modules.push(new loadedModules[module.key](this, definition));
			}
		}
	}

	parseBlock(textOrArray) {
		if (textOrArray) {
			return arrayHelper.parseArray(textOrArray).map(this.replaceTaskRoles.bind(this));
		} else {
			return [];
		}
	}

	/**
	 * Create a dict taskRolesMap to be able to determine role-->actor. Then
	 * create function replaceTaskRoles(text) to allow changing text like
	 * "{{role:crewB}}" into "EV1" if taskRolesMap['crewB'] === 'EV1'
	 *
	 * FIXME this seems excessive to do on every step
	 *
	 * @param  {Object} taskRoles  -  object of TaskRole objects. Example:
	 *                    taskRoles === {
	 *                      crewA: TaskRole{
	 *                        name: 'crewA',
	 *                        description: 'Crewmember exiting A/L first',
	 *                        actor: 'EV1'
	 *                      },
	 *                      crewB: TaskRole{
	 *                        name: 'crewB',
	 *                        description: 'Crewmember exiting A/L second',
	 *                        actor: 'EV2'
	 *                      }
	 *                    }
	 */
	mapTaskRolesToActor(taskRoles) {
		this.context.taskRoles = taskRoles;
		this.context.taskRolesMap = {};
		for (const role in taskRoles) {
			this.context.taskRolesMap[role] = taskRoles[role].actor;
		}
	}

	replaceTaskRoles(text) {
		for (const role in this.context.taskRolesMap) {
			text = text.replace(`{{role:${role}}}`, this.context.taskRolesMap[role]);
		}
		return text;
	}

	// fixme good docs
	setActors(actorIdOrIds = false, definition = false) { // FIXME WAS definitionActor = null) {

		// if no new value provided, don't change this.context.actorIdOrIds to a falsy value
		// fixme why?
		if (actorIdOrIds) {
			this.context.actorIdOrIds = arrayHelper.parseArray(actorIdOrIds);
		}

		// def.actor often undefined. Most steps do not explicitly
		// define who the actor  is. Instead, it's inferred from the Series the Step is within. If
		// it is defined, set it here. Otherwise, allow to be set to undefined. If definition not
		// supplied to this function, allow this.props.definitionActor to stay unchanged.
		if (definition) {
			this.props.definitionActor = definition.actor;
		}

		this.context.actors = arrayHelper.parseArray(
			// this.props.definitionActor ? this.props.definitionActor : this.context.actorIdOrIds
			this.props.definitionActor || this.context.actorIdOrIds || []
		);
	}

	getActors() {
		return this.context.actors;
	}

	getLocation() {
		return this.props.definitionLocation;
	}

	/**
	 * Return formatted title
	 *
	 * @param   {*} titleYaml YAML for the title
	 * @return  {*} array of substeps
     */
	parseTitle(titleYaml) {
		const title = this.replaceTaskRoles(titleYaml);

		const titleWarnings = [];

		// check if text like "(01:15)" is in the title and warn against it
		const regex = /\([\d\w]{2}:[\d\w]{2}\)/g;
		if (regex.test(title)) {
			titleWarnings.push(
				`Should not have "${title.match(regex)}" within title, use duration field`
			);
		}

		// check if duration is zero, and recommend adding duration
		if (this.props.duration.getTotalSeconds() === 0) {
			titleWarnings.push(
				'Should include "duration" field with hours, minutes, and/or seconds field'
			);
			titleWarnings.push('Example:\n     duration:\n       hours: 1\n       minutes: 15');
		}

		// warn if necessary
		if (titleWarnings.length > 0) {
			consoleHelper.warn(titleWarnings, `Title "${title}"`);
		}

		return title;
	}

	/**
	 * Return formatted step text
	 *
	 * @param   {*} stepTextYaml YAML for the step text
	 * @return  {Array} array of substeps
	 */
	parseStepText(stepTextYaml) {
		// return stepTextYaml;
		return this.replaceTaskRoles(stepTextYaml);
	}

	// this is a shim because Step now requires reference to the Series it resides within, and thus
	// so do Steps in substeps, e.g. Step.props.substeps === [Step, Step, ...]. At some point this
	// may change to Step.subseries === Subseries, where Subseries is related to Series (one
	// inherits from the other, or they share an ancestor).
	makeSubseries() {
		return {
			constructor: { name: 'DummySeries' },
			taskRoles: this.parent.taskRoles,
			seriesActors: this.parent.seriesActors,
			parent: this
		};
	}

	isSubstep() {
		return this.parent.constructor.name !== 'Series';
	}

	getRootStep() {
		if (this.isSubstep()) {
			let currentStep = this.parent.parent;
			while (currentStep.isSubstep()) {
				currentStep = currentStep.parent.parent;
			}
			return currentStep;
		} else {
			return this; // this already is the root step, so return self
		}
	}

	getRootSeries() {
		return this.getRootStep().parent;
	}

	/**
	 * Returns an array of substeps for the step, or an empty array if none are found.
	 *
	 * @param   {string|Array} substepsDefinition YAML for the substeps
	 * @return  {Array} array of substeps
	 */
	parseSubsteps(substepsDefinition) {

		const substeps = [];

		// Check for string. If string, it's not multiple substeps but a single
		// ! FIXME: Realistically why write a substep this way? Wouldn't you want it indented?
		if (typeof substepsDefinition === 'string') {
			substeps.push(new Step(substepsDefinition, this.makeSubseries()));

		// Check for array
		} else if (Array.isArray(substepsDefinition)) {
			for (const singleSubstepDef of substepsDefinition) {
				substeps.push(new Step(singleSubstepDef, this.makeSubseries()));
			}

		// Don't know how to process
		} else {
			throw new Error(
				`Expected substeps to be string or array. Instead got: ${JSON.stringify(substepsDefinition)}`
			);
		}

		return substeps;

	}

	getActivityStepNumber(numberedProps = undefined) {
		const series = this.getRootSeries();
		const division = series.parent;
		const activity = division.parent;

		// return series.getSeriesStepNumber(this) +
		// division.getNumStepsPriorToSeries(series) +
		// activity.getNumStepsPriorToDivision(division);
		const s = series.getSeriesStepNumber(this, numberedProps);
		const d = division.getNumStepsPriorToSeries(series);
		const a = activity.getNumStepsPriorToDivision(division);

		// console.log({ s, d, a });
		return s + d + a;

	}

	getProcedureStepNumber(numberedProps = undefined) {
		const activity = this.getRootSeries().parent.parent;
		const procedure = activity.procedure;
		return procedure.getNumStepsPriorToActivity(activity) +
			this.getActivityStepNumber(numberedProps);
	}

	getSubstepNumber(numberedProps = undefined) {
		//            DummySeries ⮢       ⮣ parent Step
		const substepList = this.parent.parent.props.substeps;
		let stepNum = 1;
		for (let i = 0; i < substepList.length; i++) {
			if (substepList[i] === this) {
				return stepNum;
			} else {
				stepNum += substepList[i].getNumberingImpact(numberedProps);
			}
		}
		throw new Error(`sub-Step ${this.uuid} not within ${this.parent.parent.uuid}`);
	}

	getSubstepNumbers(numberedProps = undefined) {
		const parentStepNums = [];
		let currentStep = this;
		let currentSeries = this.parent;
		while (currentSeries.constructor.name === 'Step' ||
			currentSeries.constructor.name === 'DummySeries'
		) {
			if (currentSeries.constructor.name === 'DummySeries') {
				// const substepNum = currentSeries.parent.props.substeps.indexOf(currentStep);
				const substepNum = currentStep.getSubstepNumber(numberedProps);
				parentStepNums.push(substepNum);
			}

			currentStep = currentSeries.parent;
			currentSeries = currentStep.parent;
		}
		return parentStepNums.reverse();
	}

	// FIXME: TaskWriter needs to influence this, so it matches up with display
	// FIXME: need to make modules state whether they impact numbering
	getNumberingImpact(numberedProps = ['text']) {
		for (const prop of numberedProps) {
			if (this.propIsPresent(prop)) {
				return 1;
			}
		}
		return 0;
	}

	propIsPresent(prop) {
		if (prop === 'text') {
			return this.props.text.length > 0;
		} else if (prop === 'title') {
			return !!this.props.title;
		} else {
			throw new Error('This function not yet complete, more prop types must be added');
		}
	}

	getAdjacentActivitySteps() {

		const rootSeries = this.parent;
		if (this.parent.constructor.name !== 'Series') {
			return { prev: null, next: null };
		}
		const adjacents = rootSeries.getAdjacentSteps(this);

		if (adjacents.next && adjacents.prev) {
			return adjacents;
		}

		for (const direction of ['prev', 'next']) {
			if (!adjacents[direction]) {
				adjacents[direction] = direction === 'prev' ?
					rootSeries.getStepBefore() :
					rootSeries.getStepAfter();
			}
		}

		// regardless of whether next/prev steps found, return now. If either are null then there
		// are no steps in that direction.
		return adjacents;
	}

};
