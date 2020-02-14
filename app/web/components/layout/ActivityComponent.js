const React = require('react');
const PropTypes = require('prop-types');

const DivisionComponent = require('./DivisionComponent');
const DivisionControlsComponent = require('./DivisionControlsComponent');

const stateHandler = require('../../state/index');

const filters = require('../../../helpers/filters');

class ActivityComponent extends React.Component {

	state = {
		activityState: false
	}

	constructor(props) {
		super(props);
		// console.log('Constructing ActivityComponent');

		this.unsubscribeFns = {
			deleteDivision: null,
			insertDivision: null,
			appendDivision: null
		};

	}

	// Fixme this probably can stay in constructor...
	componentDidMount() {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		for (const activityModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[activityModelMethod] = activity.subscribe(
				activityModelMethod, // insertDivision, deleteDivision, etc
				(newState) => { // perform this func when the Activity method is run
					console.log(`Running subscribed method for Task.${activityModelMethod}`);
					this.setState({ activityState: newState });
				}
			);
		}

	}

	componentWillUnmount() {
		for (const activityModelMethod in this.unsubscribeFns) {
			this.unsubscribeFns[activityModelMethod](); // run each unsubscribe function
		}
	}

	// FIXME: largely copied from a procedure writer class, setTaskTableHeader()
	getTableHeaderCells() {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		const columnKeys = activity.getColumns(true);
		const columnNames = [];

		for (const colKey of columnKeys) {
			columnNames.push(
				stateHandler.state.procedure.ColumnsHandler.getDisplayTextFromColumnKey(colKey)
			);
		}

		return columnNames.map((name) => (
			<th
				key={filters.uniqueHtmlId(`table-header-${name}`)}
				style={{ width: `${100 / columnKeys.length}%` }}>{name}</th>
		));
	}

	render() {
		const activity = stateHandler.state.procedure.getTaskByUuid(this.props.activityUuid);

		console.log(`rendering activity ${this.props.activityUuid}`);
		const procWriter = stateHandler.state.procedureWriter;
		return (
			<div className='activityWrapper'>
				<h2
					id={filters.uniqueHtmlId(activity.title)}
					data-level="procedure"
					data-task={activity.title}
				>
					{stateHandler.state.procedure.name} - {' '}
					{activity.title} {' '}
					({procWriter.getTaskDurationDisplay(activity)})
				</h2>
				<table className="gridtable">
					<thead>
						<tr>
							{this.getTableHeaderCells()}
						</tr>
					</thead>
					<tbody>
						{activity.concurrentSteps.map((division) => {
							return (
								<React.Fragment
									key={division.uuid + '-wrapper'}
								>
									{/* <DivisionControlsComponent
										activityUuid={this.props.activityUuid}
										divisionUuid={division.uuid}
										canDelete={true}
									/> */}
									<DivisionComponent
										key={division.uuid + '-component'}
										activityUuid={this.props.activityUuid}
										divisionUuid={division.uuid}
									/>
								</React.Fragment>
							);
						})}
						<DivisionControlsComponent
							activityUuid={this.props.activityUuid}
							divisionUuid='last'
						/>
					</tbody>
				</table>
			</div>
		);
	}

}

ActivityComponent.propTypes = {
	// procedure: PropTypes.object.isRequired,
	// activity: PropTypes.object.isRequired,
	// getProcedureWriter: PropTypes.func.isRequired,
	// activityIndex: PropTypes.number.isRequired
	activityUuid: PropTypes.string.isRequired
};

module.exports = ActivityComponent;
