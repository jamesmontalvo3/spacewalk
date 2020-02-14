const React = require('react');
const PropTypes = require('prop-types');
const { DndProvider } = require('react-dnd');
const Backend = require('react-dnd-html5-backend').default;

const ASMenuComponent = require('../layout/ActivitySelector/ASMenuComponent');
const stateHandler = require('../../state/index');

const ActivityComponent = require('../layout/ActivityComponent');
const SummaryTimelineComponent = require('../layout/SummaryTimelineComponent');

class ProcedureViewerComponent extends React.Component {

	constructor(props) {
		super(props);

		this.state = {
			currentActivityUuid: stateHandler.state.procedure.tasks[0].uuid,
			showTimeline: true
		};
	}

	updateCurrentActivity = (activityUuid) => {
		console.log(`switching to activity ${activityUuid}`);
		this.setState({ currentActivityUuid: activityUuid });
	}

	showTimeline = (show) => {
		console.log(show ? 'showing timeline' : 'hiding timeline');
		this.setState({ showTimeline: show });
	}

	render() {

		console.log('render ProcedureViewerComponent');

		return (
			<DndProvider backend={Backend}>
				{ this.state.currentActivityUuid && !this.state.showTimeline ?
					<React.Fragment>
						<ASMenuComponent
							currentActivityUuid={this.state.currentActivityUuid}
							updateCurrentActivity={this.updateCurrentActivity}
							showTimeline={this.showTimeline}
						/>
						<ActivityComponent
							key={this.state.currentActivityUuid}
							activityUuid={this.state.currentActivityUuid}
						/>
						<ASMenuComponent
							currentActivityUuid={this.state.currentActivityUuid}
							updateCurrentActivity={this.updateCurrentActivity}
							showTimeline={this.showTimeline}
						/>
					</React.Fragment> :
					<SummaryTimelineComponent
						showTimeline={this.showTimeline}
						updateCurrentActivity={this.updateCurrentActivity}
					/>
				}
			</DndProvider>
		);

	}
}

ProcedureViewerComponent.propTypes = {
	procedureFile: PropTypes.string.isRequired
};

module.exports = ProcedureViewerComponent;
