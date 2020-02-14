const React = require('react');
const { useDrag } = require('react-dnd');

const ItemTypes = require('../../../model/ItemTypes');
const PropTypes = require('prop-types');
const StepDropLocationComponent = require('./StepDropLocationComponent');
const InsertStepButtonComponent = require('./InsertStepButtonComponent');
// const stateHandler = require('../../state/index');

const liStyle = {
	position: 'relative'
};

const editButtonsContainerStyle = {
	position: 'absolute',
	backgroundColor: '#eee',
	right: '3px',
	top: '-20px'
};

/**
 * @param {Function} editFn    Function to be run when clicking edit button
 * @param {Function} deleteFn  Function to be run when clicking delete button
 * @param {string} activityUuid
 * @param {string} divisionUuid
 * @param {string} primaryColumnKey
 * @param {number} stepIndex
 * @param {Function} insertStepBefore
 * @return {Object}            React component
 */
function renderButtons(editFn, deleteFn, activityUuid, divisionUuid, primaryColumnKey, stepIndex) {
	return (
		<div style={editButtonsContainerStyle} className='modify-step-button-container'>
			<button
				onClick={editFn}
				className='edit-button'
			>
				edit
			</button>
			<button
				onClick={deleteFn}
				className='delete-button'
			>
				delete
			</button>
			<InsertStepButtonComponent
				buttonText='insert step before'
				activityUuid={activityUuid}
				divisionUuid={divisionUuid}
				primaryColumnKey={primaryColumnKey}
				stepIndex={stepIndex}
			/>
			{/* <button
				onClick={insertStepBefore}
				className='insert-step-before-button'
			>
				insert step before
			</button> */}
		</div>
	);
}

const StepViewerComponent = ({
	stepState, columnKeys, taskWriter,

	activityUuid, divisionUuid, primaryColumnKey, stepIndex,

	handleEditButtonClick, handleDeleteButtonClick, handleMoveStep
}) => {

	// why does this need to be set here? Is this why actors inappropriately shown in react? FIXME.
	stepState.props.columnKeys = columnKeys;

	const options = { level: 0 };

	const getStepPath = () => {
		return { activityUuid, divisionUuid, primaryColumnKey, stepIndex };
	};

	const seriesPathsMatch = (path1, path2) => {
		const match = (prop) => (path1[prop] === path2[prop]);
		return (
			match('activityIndex') &&
			match('divisionUuid') &&
			match('primaryColumnKey')
		);
	};

	const [{ isDragging }, drag] = useDrag({
		item: { type: ItemTypes.STEP },

		// Replace the value of monitor.getItem() in useDrop.canDrop() to compare dragging-step to
		// drop-location-step
		begin: () => {
			return getStepPath();
		},

		// monitor.getDropResult() set by useDrop.drop()
		end: (item, monitor) => {
			if (monitor.didDrop()) {
				const droppedAt = monitor.getDropResult();
				const draggedFrom = getStepPath();
				handleMoveStep(draggedFrom, droppedAt);
			}
		},
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging()
		})
	});

	const canDropBeforeStep = (item, monitor) => {
		const dragItem = monitor.getItem(); // .getItem() modified in useDrag.begin() above
		const thisDropItem = getStepPath();
		return !seriesPathsMatch(dragItem, thisDropItem) ||
			(
				dragItem.stepIndex !== thisDropItem.stepIndex &&
				dragItem.stepIndex !== thisDropItem.stepIndex - 1
			);
	};

	const dropOccurredBeforeStep = () => {
		const dropAt = getStepPath();
		dropAt.stepIndex--; // getStepPath gets the index of the step. Drop one index earlier.
		return dropAt;
	};

	return (
		<div
			style={{
				...liStyle,
				opacity: isDragging ? 0.5 : 1
			}}
			className={`li-level-${options.level} step-component`}
			ref={drag}
		>
			{renderButtons(
				handleEditButtonClick, handleDeleteButtonClick,
				activityUuid, divisionUuid, primaryColumnKey, stepIndex)}
			{taskWriter.insertStep(stepState)}
			<StepDropLocationComponent
				canDropFn={canDropBeforeStep}
				dropFn={dropOccurredBeforeStep}
				position='top'
			/>
		</div>
	);
};

StepViewerComponent.propTypes = {
	stepState: PropTypes.object.isRequired,
	columnKeys: PropTypes.array.isRequired,
	taskWriter: PropTypes.object.isRequired,

	// activityIndex: PropTypes.number.isRequired,
	activityUuid: PropTypes.string.isRequired,
	// divisionIndex: PropTypes.number.isRequired,
	divisionUuid: PropTypes.string.isRequired,
	primaryColumnKey: PropTypes.string.isRequired,
	stepIndex: PropTypes.number.isRequired,

	handleEditButtonClick: PropTypes.func.isRequired,
	handleDeleteButtonClick: PropTypes.func.isRequired,
	handleMoveStep: PropTypes.func.isRequired
};

module.exports = StepViewerComponent;
