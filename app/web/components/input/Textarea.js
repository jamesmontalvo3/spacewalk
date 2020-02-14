'use strict';

const React = require('react');
const PropTypes = require('prop-types');

// These were removed due to not being able to do instanceof
// const Procedure = require('../../../model/Procedure');
// const Task = require('../../../model/Task');
// const ConcurrentStep = require('../../../model/ConcurrentStep');
// const Series = require('../../../model/Series');
// const Step = require('../../../model/Procedure');

const textareaStyle = {
	height: '80px',
	width: '100%'
};

class Textarea extends React.Component {

	constructor(props) {
		super(props);
		this.editorInput = React.createRef();
	}

	handleChange = (event) => {
		this.props.setFormState({ value: event.target.value });
	}

	render() {
		return (
			<textarea
				style={textareaStyle}
				type='text'
				defaultValue={this.props.initial}
				ref={this.editorInput}
				onChange={this.handleChange}
			/>
		);
	}
}

Textarea.propTypes = {
	initial: PropTypes.string.isRequired,
	setFormState: PropTypes.func.isRequired
};

module.exports = Textarea;
