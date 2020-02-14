const React = require('react');
const PropTypes = require('prop-types');

const stateHandler = require('../../../state/index');

class ASButtonComponent extends React.Component {

	handleChange = (event) => {
		// this.setState('')
		this.props.updateCurrentActivity(event.target.value);
	}

	render() {
		return (
			<select value={this.props.activityUuid} onChange={this.handleChange}>
				{this.props.activityOrder.map((activityUuid) => {
					return (
						<option value={activityUuid} key={activityUuid}>
							{this.props.titleDisplay(
								stateHandler.state.procedure.getTaskByUuid(activityUuid).title
							)}
						</option>
					);
				})}
			</select>
		);
	}

}

ASButtonComponent.propTypes = {
	activityUuid: PropTypes.string.isRequired,
	activityOrder: PropTypes.array.isRequired,
	updateCurrentActivity: PropTypes.func.isRequired,
	titleDisplay: PropTypes.func.isRequired
};

module.exports = ASButtonComponent;
