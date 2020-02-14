const React = require('react');
const PropTypes = require('prop-types');

const stateHandler = require('../../../state/index');

const ASDropdownComponent = require('./ASDropdownComponent');
const ASActivityButtonComponent = require('./ASActivityButtonComponent');

class ASMenuComponent extends React.Component {

	constructor(props) {
		super(props);

		this.unsubscribeFns = {
			deleteTask: null,
			insertTask: null,
			moveTask: null
		};

		if (!this.state || !this.state.activityOrder) {
			this.state = {
				activityOrder: stateHandler.state.procedure.TasksHandler.getTaskUuids()
			};
		}
	}

	// Fixme this probably can stay in constructor...
	componentDidMount() {

		for (const modelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[modelMethod] = stateHandler.state.procedure.TasksHandler.subscribe(
				modelMethod,
				(newState) => { // perform this func when the TasksHandler method is run
					console.log(`Running subscribed method for TasksHandler.${modelMethod}`);
					this.setState({ activityOrder: newState.getTaskUuids() });
				}
			);
		}

	}

	componentWillUnmount() {
		for (const modelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[modelMethod](); // run each unsubscribe function
		}
	}

	titleDisplay(title) {
		if (title.length < 33) {
			return title;
		}
		return title.substring(0, 32) + '...';
	}

	handleViewTimelineClick = () => {
		this.props.showTimeline(true);
	}

	render() {
		const menuStyle = {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between', // center = group middle, space-between = push to edge
			margin: '5px'
		};

		const menuSectionStyle = {
			margin: '5px',
			width: '33%'
		};

		const proc = stateHandler.state.procedure;
		const currentIndex = proc.TasksHandler.getTaskIndexByUuid(
			this.props.currentActivityUuid
		);
		const prevAct = proc.tasks[currentIndex - 1];
		const nextAct = proc.tasks[currentIndex + 1];

		return (
			<div className='activity-selector-menu' style={menuStyle}>
				<div style={{ ...menuSectionStyle, textAlign: 'left' }}>
					{ prevAct ?
						<ASActivityButtonComponent
							prevArrow={true}
							activityUuid={prevAct.uuid}
							titleDisplay={this.titleDisplay}
							updateCurrentActivity={this.props.updateCurrentActivity}
						/> :
						null
					}
				</div>
				<div style={{ ...menuSectionStyle, textAlign: 'center' }}>
					<ASDropdownComponent
						activityUuid={this.props.currentActivityUuid}
						activityOrder={this.state.activityOrder}
						titleDisplay={this.titleDisplay}
						updateCurrentActivity={this.props.updateCurrentActivity}
					/>
					<button
						style={{ marginLeft: '5px' }}
						onClick={this.handleViewTimelineClick}
					>
						View timeline
					</button>
				</div>
				<div style={{ ...menuSectionStyle, textAlign: 'right' }}>
					{ nextAct ?
						<ASActivityButtonComponent
							nextArrow={true}
							activityUuid={nextAct.uuid}
							titleDisplay={this.titleDisplay}
							updateCurrentActivity={this.props.updateCurrentActivity}
						/> :
						null
					}
				</div>
			</div>
		);
	}

}

ASMenuComponent.propTypes = {
	currentActivityUuid: PropTypes.string.isRequired,
	updateCurrentActivity: PropTypes.func.isRequired,
	showTimeline: PropTypes.func.isRequired
};

module.exports = ASMenuComponent;
