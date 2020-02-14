const React = require('react');
const PropTypes = require('prop-types');
const uuidv4 = require('uuid/v4');

const SummaryTimelineBlockDropLocationComponent = require('./SummaryTimelineBlockDropLocationComponent');
const SummaryTimelineBlockComponent = require('./SummaryTimelineBlockComponent');
const ReactTimelineWriter = require('../../../writer/timeline/ReactTimelineWriter');

const stateHandler = require('../../state/index');

class SummaryTimelineComponent extends React.Component {

	constructor(props) {
		super(props);

		this.state = {
			activityOrder: stateHandler.state.procedure.TasksHandler.getTaskUuids()
		};

		this.unsubscribeFns = [];

		// subscribe to TasksHandler functions
		this.tasksHandlerSetStateSubscriptions = [
			'deleteTask',
			'insertTask',
			'moveTask'
		];

		// subscribe to TasksHandler functions that will impact the timeline but are not tied to
		// local state. Each of these are really _Task_ functions, not _TasksHandler_, but
		// TasksHandler handles the subscription so UI doesn't have to subscribe to _every_ task.
		this.tasksHandlerRerenderSubscriptions = [
			'timeUpdates',
			'setState'
		];

	}

	componentDidMount() {
		for (const modelMethod of this.tasksHandlerSetStateSubscriptions) {
			this.unsubscribeFns.push(
				stateHandler.state.procedure.TasksHandler.subscribe(
					modelMethod,
					(newState) => {
						console.log(`Running subscribed method for TasksHandler.${modelMethod}`);
						this.setState({ activityOrder: newState.getTaskUuids() });
					}
				)
			);
		}

		for (const modelMethod of this.tasksHandlerRerenderSubscriptions) {
			this.unsubscribeFns.push(
				stateHandler.state.procedure.TasksHandler.subscribe(
					modelMethod,
					(task) => {
						console.log(`forcing timeline render due to ${modelMethod} event on ${task.title}`);
						// this.forceUpdate(); // FIXME is this best way? No state is tracking this.
						this.setState(this.state);
					}
				)
			);
		}

	}

	componentWillUnmount() {
		for (const unsubscribe of this.unsubscribeFns) {
			unsubscribe(); // run each unsubscribe function
		}

		const editorNode = stateHandler.getEditorNode();
		if (editorNode && editorNode.constructor && editorNode.constructor.name === 'Task') {
			stateHandler.unsetEditorNode('SummaryTimelineComponent componentWillUnmount()');
		}
	}

	render() {
		// FIXME hopefully we can make this not need to be rebuild on each render
		const timelineWriter = new ReactTimelineWriter(stateHandler.state.procedure);
		const { columnDisplay, timelineMarkings } = timelineWriter.create(); // columnWidth not used

		const timelineStyle = {
			marginTop: '10px'
		};
		const headerStyle = {
			textAlign: 'center'
		};
		return (
			<div>
				<div style={headerStyle}>
					<h2>{stateHandler.state.procedure.name} - Summary Timeline</h2>
					<h4>PET {stateHandler.state.procedure.getActualDuration().format('H:M')}</h4>
				</div>
				<div className='timeline' style={timelineStyle}>
					{this.genTimelineMarkings(timelineMarkings, true)}
					{this.getColumnDisplay(columnDisplay)}
					{this.genTimelineMarkings(timelineMarkings, false)}
				</div>
			</div>
		);
	}

	genTimelineMarkings(timelineMarkings, tickBefore = true) {
		const timelineMarkingsClass = tickBefore ?
			'timeline-markings align-right' : 'timeline-markings';

		return (
			<div className="column-pet">
				<div className='column-header'></div>
				<div className={timelineMarkingsClass}>
					{timelineMarkings.map((timelineMarking) => {
						return (
							<div
								className="timeline-marking"
								style={{ height: timelineMarking.blockHeight + 'px' }}
								key={uuidv4()}
							>
								{ tickBefore ? null : <div className="tick"></div> }
								<div className="half-hour-increment">
									{timelineMarking.timeString}
								</div>
								{ tickBefore ? <div className="tick"></div> : null }
							</div>

						);
					})}
				</div>
			</div>
		);
	}

	dropOccurredEnd = () => {
		return { dropAtUuid: false };
	}

	// create a function for this dropColumnIndex
	createCanDropEnd(dropColumnIndex) {
		return (item, monitor) => {
			// .getItem() modified in useDrag.begin() above
			const { draggingUuid, draggingColumnIndex } = monitor.getItem();

			const endpoints = stateHandler.state.procedure.taskEndpoints;
			// console.log('time sync and stuff', stateHandler.state.procedure.taskEndpoints);
			// return true;
			const actors = Object.keys(endpoints);
			const endpointUuids = actors.map((actor) => {
				return endpoints[actor].last.uuid;
			});

			return dropColumnIndex === draggingColumnIndex &&
				endpointUuids.indexOf(draggingUuid) === -1;
		};
	}

	getColumnDisplay(columnDisplay) {

		return columnDisplay.map((column, columnIndex) => {
			const activityBlocksClasses = `activity-blocks activity-blocks-${columnIndex} striped-background`;

			return (
				<div className="column-ev" key={uuidv4()}>
					<div className='column-header'>
						{column.header}
					</div>
					<div className={activityBlocksClasses} style={{ position: 'relative' }}>
						{column.activityBlocks.map((activityOptions) => {
							// return this.getReactBlock(activityOptions);
							const {
								height, fillColor, textSize, marginTop,
								title, duration, uuid, minutesGap
							} = activityOptions;

							return (<SummaryTimelineBlockComponent
								height={height}
								fillColor={fillColor}
								textSize={textSize}
								marginTop={marginTop}
								title={title}
								duration={duration}
								minutesGap={minutesGap}
								uuid={uuid}
								key={uuidv4()}
								columnIndex={columnIndex}
								showTimeline={this.props.showTimeline}
								updateCurrentActivity={this.props.updateCurrentActivity}
							/>);
						})}
						<SummaryTimelineBlockDropLocationComponent
							canDropFn={this.createCanDropEnd(columnIndex)}
							dropFn={this.dropOccurredEnd}
							position='bottom'
						/>
					</div>
				</div>
			);
		});
	}

	handleMoveUpClick = (event) => {
		console.log(`clicked "move up" for timeline activity ${event.target.dataset.uuid}`);
		const th = stateHandler.state.procedure.TasksHandler;
		const taskIndex = th.getTaskIndexByUuid(event.target.dataset.uuid);
		if (taskIndex === 0) {
			console.error('Can\'t move it any further up');
			return;
		}
		th.moveTask(taskIndex, taskIndex - 1);
		stateHandler.saveProcedureChange();
	}

	handleMoveDownClick = (event) => {
		console.log(`clicked "move down" for timeline activity ${event.target.dataset.uuid}`);
		const proc = stateHandler.state.procedure;
		const taskIndex = proc.TasksHandler.getTaskIndexByUuid(event.target.dataset.uuid);
		if (taskIndex === proc.tasks.length - 1) {
			console.error('Can\'t move it any further down');
			return;
		}
		proc.TasksHandler.moveTask(taskIndex, taskIndex + 1);
		stateHandler.saveProcedureChange();
	}

}

SummaryTimelineComponent.propTypes = {
	showTimeline: PropTypes.func.isRequired,
	updateCurrentActivity: PropTypes.func.isRequired
};

module.exports = SummaryTimelineComponent;
