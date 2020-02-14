const React = require('react');
const PropTypes = require('prop-types');

const stateHandler = require('../../state/index');

class ViewChangesButton extends React.Component {

	constructor(props) {
		super(props);
		this.state = { viewingChanges: false };
		stateHandler.subscribe('contentView', () => {
			this.forceUpdate();
		});
	}

	viewChanges = () => {
		console.log('Beginning viewing changes');
		stateHandler.setEditorNode({ constructor: { name: 'ViewChanges' } });
		stateHandler.setState({ contentView: 'ViewChanges' });

		// FIXME hack while using synchonous functions
		setTimeout(() => {
			const result = window.maestro.getGitDiff();
			console.log('output of diff', result.output);
			const newState = { ViewChangesDiff: result.output[1] };
			if (result.error) {
				newState.ViewChangesError = result.error;
			}
			stateHandler.setState(newState);
		}, 1);
	}

	render() {
		if (!this.props.procedureFile) {
			return null;
		} else if (stateHandler.state.contentView === 'ViewChanges') {
			return <span style={{ color: 'white' }}>
				See changes below
			</span>;
		} else {
			return <a className='meastro-header-link' onClick={this.viewChanges}>
				View Changes
			</a>;
		}
	}

}

ViewChangesButton.propTypes = {
	procedureFile: PropTypes.string
};

module.exports = ViewChangesButton;
