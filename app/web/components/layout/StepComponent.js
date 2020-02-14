const React = require('react');
const PropTypes = require('prop-types');
const YAML = require('js-yaml');

const stateHandler = require('../../state/index');

const StepViewerComponent = require('./StepViewerComponent');

const liStyle = {
	position: 'relative'
};
const textareaStyle = {
	height: '80px',
	width: '100%'
};

// NOTE: See base-eva.css for :hover styles, etc

class StepComponent extends React.Component {

	state = {
		editMode: false
	}

	constructor(props) {
		super(props);

		// initialize to allow holding an in-work set of changes before saving
		// this.state.localStepState = this.props.stepState;

		this.editorInput = React.createRef();

		this.state.stepState = this.props.stepState;
		// const { prev, next } = this.state.stepState.getAdjacentActivitySteps();
		// this.state.prevUuid = prev ? prev.uuid : null;
		// this.state.nextUuid = next ? next.uuid : null;

		this.unsubscribeFns = {
			reload: null,
			trigger: null
		};

	}

	componentDidMount() {
		this.unsubscribeFns.reload = this.props.stepState.subscribe(
			'reload',
			(newState) => {
				// console.log(`running reload subscription for:
				// step # ${newState.getActivityStepNumber()}, ${newState.uuid}`);
				this.setState({
					stepState: newState
				});
			}
		);
		this.unsubscribeFns.trigger = this.props.stepState.subscribe(
			'trigger',
			() => {
				// const state = this.state.stepState;
				// console.log(`running trigger subscription for:
				// step # ${state.getActivityStepNumber()}, ${state.uuid}`);
				this.forceUpdate();
			}
		);
	}

	componentWillUnmount() {
		for (const modelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[modelMethod](); // run each unsubscribe function
		}
	}

	handleEditButtonClick = (e) => {
		console.log(`edit button click for ${this.state.stepState.uuid}`);
		e.preventDefault();
		e.stopPropagation();
		this.setState({ editMode: true });
	}

	handleDeleteButtonClick = (e) => {
		console.log('DELETE button click');
		e.preventDefault();
		e.stopPropagation();
		this.doDelete();
	}

	doDelete() {
		this.props.deleteStepFromSeries(this.props.stepIndex);

		const activityIndex = stateHandler.state.procedure
			.TasksHandler.getTaskIndexByUuid(this.props.activityUuid);

		stateHandler.saveChange(activityIndex);
	}

	// FIXME isn't this in separete maestroKey.js file now?
	getKey() {
		return `act${this.props.activityUuid}-div${this.props.divisionUuid}-${this.props.primaryColumnKey}-step${this.props.stepIndex}`;
	}

	render() {
		// console.log(`rendering StepComponent ${this.props.stepIndex}`);

		const emptyDefinition = Object.keys(this.props.stepState.getDefinition()).length === 0;

		return this.state.editMode || emptyDefinition ?
			this.renderEditor() :
			(
				<StepViewerComponent
					stepState={this.props.stepState}
					columnKeys={this.props.columnKeys}
					taskWriter={this.props.taskWriter}

					activityUuid={this.props.activityUuid}
					divisionUuid={this.props.divisionUuid}
					primaryColumnKey={this.props.primaryColumnKey}
					stepIndex={this.props.stepIndex}

					handleEditButtonClick={this.handleEditButtonClick}
					handleDeleteButtonClick={this.handleDeleteButtonClick}
					handleMoveStep={this.props.handleMoveStep}
				/>
			);
	}

	renderEditor() {

		const options = { level: 0 };

		// was: this.state.localStepState.text
		let initial = YAML.safeDump(this.props.stepState.getDefinition());

		if (initial.trim() === '{}') {
			initial = 'text: <insert text>';
		}

		// had: onChange={this.handleEditTextChange}
		return (
			<div
				style={liStyle}
				className={`li-level-${options.level}`}
			>
				<div>
					<textarea
						style={textareaStyle}
						type='text'
						defaultValue={initial}
						ref={this.editorInput}
					/>
				</div>
				<button className='save-button' onClick={this.handleSave}>save</button>
				<button className='cancel-button' onClick={this.handleCancel}>cancel</button>
			</div>
		);

	}

	handleSave = (e) => {
		console.log('handle save');

		e.preventDefault();
		e.stopPropagation();

		const newDefinition = YAML.safeLoad(this.editorInput.current.value);

		// update the state with new definition
		this.props.stepState.reload(newDefinition);

		const activityIndex = stateHandler.state.procedure
			.TasksHandler.getTaskIndexByUuid(this.props.activityUuid);

		stateHandler.saveChange(activityIndex);

		this.setState({
			editMode: false
			// localStepState: newStep
		});
	}

	handleCancel = (e) => {
		console.log('handle cancel');

		e.preventDefault();
		e.stopPropagation();
		if (Object.keys(this.props.stepState.getDefinition()).length === 0) {
			this.doDelete();
		}
		this.setState({
			editMode: false
			// localStepState: this.props.stepState
		});
	}

}

StepComponent.propTypes = {

	stepState: PropTypes.object.isRequired,
	columnKeys: PropTypes.array.isRequired,
	taskWriter: PropTypes.object.isRequired,

	// activityIndex: PropTypes.number.isRequired,
	activityUuid: PropTypes.string.isRequired,
	// divisionIndex: PropTypes.number.isRequired,
	divisionUuid: PropTypes.string.isRequired,
	primaryColumnKey: PropTypes.string.isRequired,
	stepIndex: PropTypes.number.isRequired,

	deleteStepFromSeries: PropTypes.func.isRequired,
	handleMoveStep: PropTypes.func.isRequired
	// insertStepIntoSeries: PropTypes.func.isRequired
};

module.exports = StepComponent;
