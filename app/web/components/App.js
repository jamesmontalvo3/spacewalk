const React = require('react');
const YAML = require('js-yaml');

const stateHandler = require('../state/index');
const ExportToWordButton = require('./layout/ExportToWordButton');
const ViewChangesButton = require('./layout/ViewChangesButton');
const SidebarComponent = require('./layout/SidebarComponent');
const Modal = require('./layout/Modal');
const ProcedureViewerComponent = require('./pages/ProcedureViewerComponent');
const ProcedureSelectorComponent = require('./pages/ProcedureSelectorComponent');
const GitDiffContentPanel = require('./pages/GitDiffContentPanel');
const ReactProcedureWriter = require('../../writer/procedure/ReactProcedureWriter');

class App extends React.Component {

	constructor() {
		super();
		window.appComponent = this;
		stateHandler.subscribe('contentView', () => {
			this.forceUpdate();
		});
	}

	state = {
		procedureFile: null
	}

	setProcedure = (procObject) => {

		stateHandler.setState({
			procedure: procObject,

			// this.program is set in ElectronProgram constructor...FIXME?
			program: this.program,

			procedureWriter: new ReactProcedureWriter(window.maestro.app, procObject),

			// Set initial YAML representation of entire procedure (including activities). Changes
			// can diff against this.
			lastProcDefinitionYaml: YAML.dump(procObject.getDefinition())
		});

		this.setState({
			procedureFile: stateHandler.state.procedure.filename
		});

		console.log(`Procedure set to ${procObject.name}`);
	};

	// FIXME is this still needed? Used by electron? should be easier to tell.
	// Need to replace electrons <p>...</p> with a compoenent that at least makes it more obvious
	getProcedureWriter = () => {
		// return this.state.procedureWriter;
		return stateHandler.state.procedureWriter;
	}

	setProgram(program) {
		this.program = program;
	}

	renderProcedure() {
		if (!stateHandler.state.contentView) {
			return <ProcedureViewerComponent
				procedureFile={this.state.procedureFile}
			/>;
		} else if (stateHandler.state.contentView === 'ViewChanges') {
			return <GitDiffContentPanel />;
		} else {
			return <div>Unknown content selected</div>;
		}
	}

	renderNoProcedure() {
		if (window.isElectron) {
			return (<p>Please select a procedure file from the file:open menu</p>);
		} else {
			return (
				<ProcedureSelectorComponent setProcedure={this.setProcedure} />
			);
		}
	}

	render() {
		return (
			<React.Fragment>
				<header id='main-header'>
					<h1 style={{ float: 'left', marginLeft: '10px' }}>
						Maestro <span style={{ fontSize: '12px' }}>
							{this.program ? `v${this.program.version}` : null }
						</span>
					</h1>
					<div style={{ float: 'right', margin: '20px 20px 0 0' }}>
						<ExportToWordButton procedureFile={this.state.procedureFile} />
					</div>
					<div style={{ float: 'right', margin: '20px 20px 0 0' }}>
						<ViewChangesButton procedureFile={this.state.procedureFile} />
					</div>
				</header>
				<div id='sidebar-and-content-wrapper'>
					<div id="sidebar">
						<SidebarComponent />
					</div>
					<div id='content'>
						{typeof this.state.procedureFile === 'string' ?
							this.renderProcedure() : this.renderNoProcedure()
						}
					</div>
				</div>
				<Modal>
					<div style={{ backgroundColor: 'green' }}>this is a test</div>
				</Modal>
			</React.Fragment>
		);
	}
}

module.exports = App;
