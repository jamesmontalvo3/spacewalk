const React = require('react');
const PropTypes = require('prop-types');
const uuidv4 = require('uuid/v4');

const StepComponent = require('./StepComponent');
const StepDropLocationComponent = require('./StepDropLocationComponent');
const InsertStepButtonComponent = require('./InsertStepButtonComponent');
const stateHandler = require('../../state/index');

const seriesPathsMatch = (path1, path2) => {
	const match = (prop) => (path1[prop] === path2[prop]);
	return (
		match('activityUuid') &&
		match('divisionUuid') &&
		match('primaryColumnKey')
	);
};

class SeriesComponent extends React.Component {

	state = {
		seriesState: false
	}

	constructor(props) {
		super(props);

		// console.log('constructing series component', this.props);
		// console.log('constructing series component');

		// FIXME get this from Series, or better yet from someplace centralized. So either:
		//   a) this.unsubscribeFns = Series.getUnsubscribeFns()
		//   b) In Series: subscriptionHelper.registerSubscriptionFns('Series', [list, of, fns])
		//      In SeriesComponent:
		//           this.unsubscribeFns = subscriptionHelper.getUnsubscribeFns('Series')
		this.unsubscribeFns = {
			appendStep: null,
			deleteStep: null,
			insertStep: null,
			transferStep: null
		};

	}

	componentDidMount() {

		this.unsubscribeFns.appendStep = this.props.seriesState.subscribe(
			'appendStep',
			(newState, stepModel) => {
				this.setState({ seriesState: newState });
				this.triggerStepAfterUuid(stepModel.uuid);
			}
		);

		this.unsubscribeFns.deleteStep = this.props.seriesState.subscribe(
			'deleteStep',
			(newState, prevUuid, nextUuid) => {
				this.setState({ seriesState: newState });
				const uuid = prevUuid || nextUuid;
				if (uuid) {
					this.triggerStepAfterUuid(uuid);
				}
			}
		);

		this.unsubscribeFns.insertStep = this.props.seriesState.subscribe(
			'insertStep',
			(newState, stepModel) => {
				this.setState({ seriesState: newState });
				this.triggerStepAfterUuid(stepModel.uuid);
			}
		);

		this.unsubscribeFns.transferStep = this.props.seriesState.subscribe(
			'transferStep',
			(contextSeries, sourceSeries, removalIndex, destinationSeries, transferredStep) => {
				this.setState({ seriesState: contextSeries });

				// transferStep emits two notifications to subscription functions: one for the
				// source series, one for the destination. Don't run this update for both.
				if (contextSeries === sourceSeries) {
					let priorStep = sourceSeries.steps[removalIndex - 1];
					if (!priorStep) {
						priorStep = sourceSeries.getStepBefore();
						if (!priorStep) {
							priorStep = sourceSeries.getStepAfter();
						}
					}
					const earlierUuid = stateHandler.state.procedure.indexer.earlier(
						priorStep.uuid, transferredStep.uuid
					);
					this.triggerStepAfterUuid(earlierUuid);
				}
			}
		);
	}

	getSeriesPath = () => {
		return {
			// activityIndex: this.props.activityIndex,
			activityUuid: this.props.activityUuid,
			divisionUuid: this.props.divisionUuid,
			primaryColumnKey: this.props.primaryColumnKey
		};
	};

	triggerStepAfterUuid(afterUuid) {

		const indexer = this.props.seriesState.indexer;
		if (indexer) {
			console.log('doing indexer');
			// FIXME for now this is always re-rendering following steps. That's bad. Add a
			// subscription to Indexer?
			indexer.after(afterUuid).map((uuid) => {
				const step = indexer.get(uuid).item;
				step.trigger();
			});
		} else {
			console.log('no indexer');
		}

	}

	componentWillUnmount() {
		for (const seriesModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[seriesModelMethod](); // run each unsubscribe function
		}
	}

	deleteStepFromSeries = (stepIndex) => {
		this.props.seriesState.deleteStep(stepIndex);
	}

	handleMoveStep = (from, to) => {

		const destinationSeries = stateHandler.state.procedure
			// .tasks[to.activityIndex]
			.getTaskByUuid(to.activityUuid)
			// .concurrentSteps[to.divisionIndex]
			.getDivisionByUuid(to.divisionUuid)
			.subscenes[to.primaryColumnKey];

		// for the end-of-series drop location, which is not attached to a StepComponent but instead
		// attached to the bottom of the SeriesComponent, there will not be a stepIndex. Instead it
		// will explicitly define the stepIndex as false. Set it to the end of the Series.
		if (to.stepIndex === false) {
			to.stepIndex = this.props.seriesState.steps.length;
		}

		this.props.seriesState.transferStep(from.stepIndex, destinationSeries, to.stepIndex);

		const activityIndex = stateHandler.state.procedure
			.TasksHandler.getTaskIndexByUuid(this.props.activityUuid);

		stateHandler.saveChange(activityIndex);

	}

	canDropAtEndOfSeries = (item, monitor) => {
		const dragItem = monitor.getItem(); // .getItem() modified in useDrag.begin() above
		const dropSeriesPath = this.getSeriesPath();

		// if the activity-->division-->series are the same, only return true if the dragged
		// item isn't the last item (can't stick it after itself)
		return seriesPathsMatch(dragItem, dropSeriesPath) ?
			(dragItem.stepIndex !== this.props.seriesState.steps.length - 1) :
			true;

	}

	dropOccurredAtEndOfSeries = () => {
		const dropLocation = { ...this.getSeriesPath(), stepIndex: false };
		return dropLocation;
	}

	render() {
		return (
			<td key={uuidv4()} colSpan={this.props.colspan} className='series-td'>
				<div style={{ position: 'relative' }}>
					<div>
						{this.props.seriesState.steps.map((step, index) => {
							return (
								<StepComponent
									key={step.uuid}
									stepState={step}
									columnKeys={this.props.columnKeys}
									taskWriter={this.props.taskWriter}

									activityUuid={this.props.activityUuid}
									divisionUuid={this.props.divisionUuid}
									primaryColumnKey={this.props.primaryColumnKey}
									stepIndex={index}

									deleteStepFromSeries={this.deleteStepFromSeries}
									handleMoveStep={this.handleMoveStep}
								/>
							);
						})}
					</div>
					<div className='series-insert-step-wrapper'>
						<div>
							<InsertStepButtonComponent
								buttonText='insert step'
								activityUuid={this.props.activityUuid}
								divisionUuid={this.props.divisionUuid}
								primaryColumnKey={this.props.primaryColumnKey}
								stepIndex={-1}
							/>
						</div>
					</div>
					<StepDropLocationComponent
						canDropFn={this.canDropAtEndOfSeries}
						dropFn={this.dropOccurredAtEndOfSeries}
						position='bottom'
					/>
				</div>
			</td>
		);
	}

}

SeriesComponent.propTypes = {
	colspan: PropTypes.number.isRequired,
	columnKeys: PropTypes.array.isRequired,
	seriesState: PropTypes.object.isRequired,
	taskWriter: PropTypes.object.isRequired,

	activityUuid: PropTypes.string.isRequired,
	divisionUuid: PropTypes.string.isRequired,
	primaryColumnKey: PropTypes.string.isRequired
};

module.exports = SeriesComponent;
