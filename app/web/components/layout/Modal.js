const React = require('react');
const PropTypes = require('prop-types');

const InitProjectModalForm = require('./InitProjectModalForm');
const stateHandler = require('../../state/index');

class Modal extends React.Component {

	constructor(props) {
		super(props);
		this.title = 'No title';
		this.unsubscribe = [];
		this.unsubscribe.push(stateHandler.subscribe('modalVisible', (/* newState */) => {
			this.forceUpdate();
		}));
		this.unsubscribe.push(stateHandler.subscribe('modalType', (/* newState */) => {
			this.forceUpdate();
		}));
		this.unsubscribe.push(stateHandler.subscribe('initProjectParentPath', (/* newState */) => {
			this.forceUpdate();
		}));
	}

	componentWillUnmount() {
		this.unsubscribe.map((fn) => fn());
	}

	close = (e) => {
		e.stopPropagation();
		stateHandler.setState({ modalVisible: false });
	}

	getContents() {
		switch (stateHandler.state.modalType) {
			case 'DEMO':
				this.title = 'Demo';
				return <div>This is just a demo</div>;
			case 'INIT_PROJECT':
				return this.getInitProject();
			default:
				this.title = 'Error';
				return <div>Error: invalid modalType</div>;
		}
	}

	getInitProject() {
		this.title = 'Create new project';
		return <InitProjectModalForm />;
	}

	render() {

		const contents = this.getContents(); // run this here so this.title gets set early
		return (
			<div
				id="modal"
				style={{
					position: 'absolute',
					top: 0, left: 0, right: 0, bottom: 0,
					backgroundColor: 'rgb(0, 0, 0, 0.5)',
					visibility: stateHandler.state.modalVisible ? 'visible' : 'hidden'
					// transition: 'all 0.3s'
				}}
			>
				<div style={{
					width: '600px',
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					backgroundColor: '#FFFFFF',
					border: 'solid black 1px',
					padding: '5px 20px 20px 20px'
				}}>
					<a href="#" title="Close" id='modal-close' onClick={this.close}>close</a>
					<h2>{this.title}</h2>
					{contents}
				</div>
			</div>

		);
	}
}

Modal.propTypes = {
	children: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired
};

module.exports = Modal;
