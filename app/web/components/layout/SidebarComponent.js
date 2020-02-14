const React = require('react');

// const Procedure = require('../../../model/Procedure');
// const Task = require('../../../model/Task');
// const ConcurrentStep = require('../../../model/ConcurrentStep');
// const Series = require('../../../model/Series');
// const Step = require('../../../model/Procedure');

const stateHandler = require('../../state/index');

const ActivityMetaForm = require('./ActivityMetaForm');
const ViewChangesCommitForm = require('./ViewChangesCommitForm');
const DivisionMetaForm = require('./DivisionMetaForm');

class SidebarComponent extends React.Component {

	state = {
		editorNode: null
	}

	constructor(props) {
		super(props);

		// FIXME this should just set a state.editorNode value rather than having functions to set
		// state within this component.
		stateHandler.setEditorNode = (editorNode, options = {}) => {
			console.log('setEditorNode() -->', editorNode);
			// stateHandler.setState({ editorNode: editorNode, editorNodeOptions: options });
			this.setState({ editorNode: editorNode, editorNodeOptions: options });
		};
		stateHandler.unsetEditorNode = (msg = 'no message') => {
			console.log(`unsetEditorNode('${msg}')`);
			// stateHandler.setState({ editorNode: null, editorNodeOptions: {} });
			this.setState({ editorNode: null, editorNodeOptions: {} });
		};
		stateHandler.getEditorNode = () => {
			return this.state.editorNode;
		};
	}

	render() {
		const models = [
			'Step',
			'Series',
			'ConcurrentStep',
			'Task',
			'Procedure',

			// FIXME: At this time, this is not a true model but will be faked with an object in the
			// form { constructor: { name: 'ViewChanges' } }. SidebarComponent should be made more
			// flexible so hacks like this are not necessary.
			'ViewChanges'
		];
		for (const model of models) {
			// if (this.state.editorNode instanceof model) {
			if (this.state.editorNode && this.state.editorNode.constructor &&
				this.state.editorNode.constructor.name === model
			) {
				return this[`render${model}Node`]();
			}
		}
		return this.renderNoEditorNode();
	}

	renderProcedureNode() {
		return <div>Sidebar Procedure editor not yet available</div>;
	}

	renderTaskNode() {
		return <ActivityMetaForm
			task={this.state.editorNode}
			editorOptions={this.state.editorNodeOptions}
		/>;
	}

	renderConcurrentStepNode() {
		return <DivisionMetaForm
			division={this.state.editorNode}
			editorOptions={this.state.editorNodeOptions}
		/>;
	}

	renderSeriesNode() {
		return <div>Sidebar Series editor not yet available</div>;
	}

	renderStepNode() {
		return <div>Sidebar Step editor not yet available</div>;
	}

	renderViewChangesNode() {
		return <ViewChangesCommitForm editorOptions={this.state.editorNodeOptions} />;
	}

	renderNoEditorNode() {

		const divStyle = {
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			width: '100%',
			height: '100%',
			fontSize: '14px'
		};

		return <div style={divStyle}>Select element to show in editor</div>;

	}
}

module.exports = SidebarComponent;
