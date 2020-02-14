const React = require('react');
const PropTypes = require('prop-types');

const stateHandler = require('../../../state/index');

class ASButtonComponent extends React.Component {

	handleClick = () => {
		console.log('activity selector button clicked');
		this.props.updateCurrentActivity(this.props.activityUuid);
	}

	render() {
		const task = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid, true);
		return (
			<button
				onClick={this.handleClick}
			>
				{ this.props.prevArrow ? '🡰 ' : null }
				{this.props.titleDisplay(task.title)}
				{ this.props.nextArrow ? ' 🡲' : null }
			</button>
		);
	}

}

ASButtonComponent.propTypes = {
	activityUuid: PropTypes.string.isRequired,
	prevArrow: PropTypes.bool,
	nextArrow: PropTypes.bool,
	updateCurrentActivity: PropTypes.func.isRequired,
	titleDisplay: PropTypes.func.isRequired
};

module.exports = ASButtonComponent;
