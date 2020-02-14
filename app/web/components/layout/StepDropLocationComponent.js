const React = require('react');
const { useDrop } = require('react-dnd');

const ItemTypes = require('../../../model/ItemTypes');
const PropTypes = require('prop-types');

const StepDropLocationComponent = ({ position, canDropFn, dropFn }) => {

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: ItemTypes.STEP,
		canDrop: canDropFn,
		drop: dropFn,
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop()
		})
	});

	const elemStyle = {
		position: 'absolute',
		height: '20px',
		width: '100%',
		display: 'none',
		opacity: isOver ? 0.6 : 0.2
	};

	if (canDrop) {
		elemStyle.display = 'block';
		elemStyle.backgroundColor = 'green';
	}

	if (position === 'top') {
		elemStyle.top = '-12px';
	} else {
		elemStyle.bottom = '0px';
	}

	return (<div ref={drop} style={elemStyle} />);
};

StepDropLocationComponent.propTypes = {
	position: PropTypes.string.isRequired,
	canDropFn: PropTypes.func.isRequired,
	dropFn: PropTypes.func.isRequired
};

module.exports = StepDropLocationComponent;
