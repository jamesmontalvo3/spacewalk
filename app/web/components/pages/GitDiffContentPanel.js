const React = require('react');

const stateHandler = require('../../state/index');

class GitDiffContentPanel extends React.Component {

	constructor(props) {
		super(props);
		this.unsubscribeFns = [];
		this.unsubscribeFns.push(
			stateHandler.subscribe('ViewChangesDiff', () => {
				this.forceUpdate();
			})
		);
		this.unsubscribeFns.push(
			stateHandler.subscribe('ViewChangesError', () => {
				this.forceUpdate();
			})
		);
		this.unsubscribeFns.push(
			stateHandler.subscribe('ViewChangesProgress', () => {
				this.forceUpdate();
			})
		);
	}
	/*
			stateHandler.setState({ ViewChangesError: result.error });
		} else {
			stateHandler.setState({ ViewChangesDiff: result.output[1] });
	*/

	componentWillUnmount() {
		this.unsubscribeFns.map((fn) => fn());
		stateHandler.setState({
			ViewChangesDiff: null,
			ViewChangesError: null
		});
	}

	formatDiff() {
		if (!stateHandler.state.ViewChangesDiff) {
			return 'No changes';
		}
		const diffArr = stateHandler.state.ViewChangesDiff.split('\n');
		return diffArr.map((line, index) => {
			let color;
			if (line[0] === '-') {
				color = 'red';
			} else if (line[0] === '+') {
				color = 'green';
			} else {
				color = 'black';
			}
			return <div key={`diff-line-${index}`} style={{ color }}>
				{line}
			</div>;
		});
	}

	render() {
		if (stateHandler.state.ViewChangesProgress) {
			return <div>
				<h2>Committing change</h2>
				<pre>{stateHandler.state.ViewChangesProgress}</pre>
			</div>;
		} else if (stateHandler.state.ViewChangesError) {
			return <div>
				<h2>An error occurred while computing changes</h2>
				<pre>{JSON.stringify(stateHandler.state.ViewChangesError, null, 2)}</pre>
			</div>;
		} else if (typeof stateHandler.state.ViewChangesDiff === 'string') {
			return <div>
				<h2>Diff</h2>
				<pre style={{ fontSize: '20px' }}>{this.formatDiff()}</pre>
			</div>;
		} else {
			return <div>Standby while changes are computed</div>;
		}
	}
}

// GitDiffContentPanel.propTypes = {};

module.exports = GitDiffContentPanel;
