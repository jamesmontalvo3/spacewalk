const React = require('react');

const PropTypes = require('prop-types');

const stateHandler = require('../../state/index');

class InsertStepButtonComponent extends React.Component {

	handleInsertStepClick = (e) => {
		console.log('insert-step button click');
		e.preventDefault();
		e.stopPropagation();

		const activityIndex = stateHandler.state.procedure
			.TasksHandler.getTaskIndexByUuid(this.props.activityUuid);

		const series = stateHandler.state.procedure.tasks[activityIndex]
			.getDivisionByUuid(this.props.divisionUuid).subscenes[this.props.primaryColumnKey];

		if (this.props.stepIndex === -1) {
			series.appendStep();
		} else {
			series.insertStep(this.props.stepIndex);
		}

		stateHandler.saveChange(activityIndex);

	}

	render() {
		return (
			<button
				onClick={this.handleInsertStepClick}
				className='insert-step-before-button'
			>
				{this.props.buttonText}
			</button>

		);
	}
}

InsertStepButtonComponent.propTypes = {
	buttonText: PropTypes.string.isRequired,
	activityUuid: PropTypes.string.isRequired,
	divisionUuid: PropTypes.string.isRequired,
	primaryColumnKey: PropTypes.string.isRequired,
	stepIndex: PropTypes.number.isRequired

	// stepState: PropTypes.object.isRequired,
	// columnKeys: PropTypes.array.isRequired,
	// taskWriter: PropTypes.object.isRequired,

	// activityUuid: PropTypes.string.isRequired,
	// divisionUuid: PropTypes.string.isRequired,
};

module.exports = InsertStepButtonComponent;
