const React = require('react');
const PropTypes = require('prop-types');
// const { render } = require('react-dom');
const { Form } = require('react-final-form');
const arrayMutators = require('final-form-arrays').default;
// const { FieldArray } = require('react-final-form-arrays');

const stateHandler = require('../../state/index');

const { checkboxInputField } = require('./formInputTypes');

const DivisionMetaForm = ({ division, editorOptions }) => {

	const calculateChange = (values) => {
		const mergedOrNot = {};

		// FIRST: Get all columns from activity, except first, and set their "merged" values to
		//        false. Skip first because it can't be merged with previous.
		const activity = stateHandler.state.procedure
			.getTaskByUuid(editorOptions.activityUuid);
		const columnsFromActivity = activity.getColumns(); // FIXME do we need to pass 'true' here?
		for (let i = 1; i < columnsFromActivity.length; i++) {
			const colKey = columnsFromActivity[i];
			mergedOrNot[colKey] = false;
		}

		// SECOND: loop over values.mergedwithprevious, setting those to true
		for (const colKey of values.mergewithprevious) {
			mergedOrNot[colKey] = true;
		}

		const newSeriesKeys = [];
		let collector = [columnsFromActivity[0]];
		for (let i = 1; i < columnsFromActivity.length; i++) {
			const colKey = columnsFromActivity[i];
			const isMergedWithPrevious = mergedOrNot[colKey];

			if (isMergedWithPrevious) {
				collector.push(colKey);
			} else {
				newSeriesKeys.push(collector.join(' + '));
				collector = [colKey];
			}
		}
		newSeriesKeys.push(collector.join(' + '));

		const currentSeriesKeys = Object.keys(division.subscenes);

		const deleting = {};
		const keeping = {};
		const creating = {};
		for (const key of newSeriesKeys) {
			if (currentSeriesKeys.indexOf(key) === -1) {
				// is in new, not in old...creating
				creating[key] = true;
			} else {
				// is in new and old...keeping
				keeping[key] = true;
			}
		}

		for (const key of currentSeriesKeys) {
			if (newSeriesKeys.indexOf(key) === -1) {
				// is in old, not in new...deleting
				deleting[key] = true;
			} else {
				// is in old and new...keeping (this should be duplicate of above but...paranoia)
				keeping[key] = true;
			}
		}

		return {
			deleting: Object.keys(deleting),
			keeping: Object.keys(keeping),
			creating: Object.keys(creating)
		};

	};

	const handleCloseEditorClick = () => {
		stateHandler.unsetEditorNode('DivisionMetaForm handleCloseEditorClick()');
	};

	const handleDeleteClick = () => {
		console.log(`clicked "delete division" for ${division.uuid}`);
		const activityIndex = stateHandler.state.procedure.TasksHandler
			.getTaskIndexByUuid(editorOptions.activityUuid);
		const activity = stateHandler.state.procedure.tasks[activityIndex];

		const divisionIndex = activity.getDivisionIndexByUuid(division.uuid);
		activity.deleteDivision(divisionIndex);

		stateHandler.saveChange(activityIndex);
		stateHandler.unsetEditorNode('DivisionMetaForm handleDeleteClick()');
	};

	// validate={insertFunction}
	const validateForm = (values) => {
		const errors = {};

		const change = calculateChange(values);
		const { deleting } = change;

		for (const key of deleting) {
			if (division.subscenes[key].steps.length > 0) {
				errors.mergewithprevious = 'Cannot delete columns that have steps';
			}
		}

		return errors;
	};

	const formatCheckbox = (colKey, actuallyAcheckbox) => {
		if (actuallyAcheckbox) {
			return <div key={colKey + '-merge-selector'}>
				{checkboxInputField('mergewithprevious', colKey, colKey, [])}
			</div>;
		} else {
			return <div
				key={colKey + '-merge-selector'}
				className='field-row'
			>
				<label>{colKey}</label>
				<div>First column - no previous</div>
			</div>;
		}
	};

	const setInitial = () => {

		const initial = { mergewithprevious: [] };

		// first make a mapping like { IV: "IV", EV1: "EV1 + EV2", EV2: "EV1 + EV2" } if EV1 and EV2
		// columns are merged, pointing expected canonical columns to actual columns
		const seriesKeys = Object.keys(division.subscenes);
		const actorToSeriesKey = {};
		for (const key of seriesKeys) {
			if (key.indexOf('+') === -1) {
				actorToSeriesKey[key] = key;
			} else {
				key.split('+').forEach((actor) => {
					actorToSeriesKey[actor.trim()] = key;
				});
			}
		}

		const activity = stateHandler.state.procedure
			.getTaskByUuid(editorOptions.activityUuid);

		const columnsFromActivity = activity.getColumns(); // FIXME do we need to pass 'true' here?
		for (let i = 1; i < columnsFromActivity.length; i++) {
			const colKey = columnsFromActivity[i];
			const prevColKey = columnsFromActivity[i - 1];

			if (
			// { IV: "IV" } not { EV1: "EV1 + EV2" }
			// colKey === actorToSeriesKey[colKey] ||

				// this and prev point to the same series, so they're merged
				actorToSeriesKey[colKey] === actorToSeriesKey[prevColKey]
			) {
				initial.mergewithprevious.push(colKey);
			}
		}
		return initial;

	};

	const mergeCheckboxes = () => {

		// first make a mapping like { IV: "IV", EV1: "EV1 + EV2", EV2: "EV1 + EV2" } if EV1 and EV2
		// columns are merged, pointing expected canonical columns to actual columns
		const seriesKeys = Object.keys(division.subscenes);
		const actorToSeriesKey = {};
		for (const key of seriesKeys) {
			if (key.indexOf('+') === -1) {
				actorToSeriesKey[key] = key;
			} else {
				key.split('+').forEach((actor) => {
					actorToSeriesKey[actor.trim()] = key;
				});
			}
		}

		const activity = stateHandler.state.procedure
			.getTaskByUuid(editorOptions.activityUuid);

		const columnsFromActivity = activity.getColumns(); // FIXME do we need to pass 'true' here?
		const things = [];
		things.push(formatCheckbox(columnsFromActivity[0], false));
		for (let i = 1; i < columnsFromActivity.length; i++) {
			const colKey = columnsFromActivity[i];
			const prevColKey = columnsFromActivity[i - 1];

			if (
				// { IV: "IV" } not { EV1: "EV1 + EV2" }
				colKey === actorToSeriesKey[colKey] ||

				// this and prev do _not_ point to the same series, so they're not merged
				actorToSeriesKey[colKey] !== actorToSeriesKey[prevColKey]
			) {
				things.push(formatCheckbox(colKey, true));
			} else {
				things.push(formatCheckbox(colKey, true));
			}
		}

		return <div>
			<h4>Merge column with previous</h4>
			{things}
		</div>;
	};

	const onSubmit = (values) => {
		// console.log('onSubmit values', values);

		const change = calculateChange(values);
		// console.log('CHANGES:', change);
		const { deleting, keeping, creating } = change;

		for (const key of deleting) {
			if (division.subscenes[key].steps.length > 0) {
				// This should never happen since validation should prevent it
				throw new Error(`series ${key} has steps. It cannot be deleted.`);
			}
			// else { console.log(`series ${key} can be deleted`); }
		}

		const newDef = { simo: {} };
		for (const key of keeping) {
			// console.log(`series ${key} is being kept. If it has steps, preserve them`);
			newDef.simo[key] = division.subscenes[key].getDefinition();
		}

		for (const key of creating) {
			// console.log(`series ${key} is being created with no content.`);
			newDef.simo[key] = []; // empty list of steps
		}

		division.setState(newDef);

	};

	return (
		<div>
			<h3>Edit Sync Block
				<button onClick={handleCloseEditorClick}>close editor</button>
				<button onClick={handleDeleteClick}>delete</button>
			</h3>
			<Form
				onSubmit={onSubmit}
				mutators={{
					...arrayMutators
				}}
				initialValues={setInitial()}
				validate={validateForm}
				render={({
					handleSubmit,
					// form: { mutators: { push } }, // injected from final-form-arrays above
					pristine,
					form,
					submitting
					// values
				}) => {
					return (
						<form onSubmit={handleSubmit} className='sidebar-form'>
							{mergeCheckboxes()}
							<div className="buttons">
								<button type="submit" disabled={submitting || pristine}>
								Save
								</button>
								<button
									type="button"
									onClick={form.reset}
									disabled={submitting || pristine}
								>
								Reset
								</button>
							</div>
						</form>
					);
				}}
			/>
		</div>
	);

};

DivisionMetaForm.propTypes = {
	division: PropTypes.object.isRequired,
	editorOptions: PropTypes.object.isRequired
};

module.exports = DivisionMetaForm;
