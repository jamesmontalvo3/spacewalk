const React = require('react');
const { Form } = require('react-final-form');
const arrayMutators = require('final-form-arrays').default;

const stateHandler = require('../../state/index');

const { textInputField, validators } = require('./formInputTypes');
const { required, minLength, maxLength } = validators;

const InitProjectModalForm = () => {

	// validate={insertFunction}
	const validateForm = (/* values */) => {
		const errors = {};

		const diff = stateHandler.state.ViewChangesDiff;
		const diffError = stateHandler.state.ViewChangesError;

		if (diffError) {
			errors.summary = 'An error occurred while calculating diff - cannot commit';
		} else if (!diff || diff.length === 0) {
			errors.summary = 'There don\'t appear to be any changes - cannot commit';
		}

		return errors;
	};

	const onSubmit = (values) => {
		stateHandler.unsetEditorNode('ViewChangesCommitForm onSubmit()');
		stateHandler.setState({
			ViewChangesProgress: 'Commiting change. This may take a few seconds.'
		});

		window.maestro.gitCommit(values.summary);

		setTimeout(() => {
			stateHandler.setState({
				ViewChangesProgress: null,
				contentView: null
			});
		}, 3000);
	};

	const handleCancel = () => {
		stateHandler.unsetEditorNode('ViewChangesCommitForm handleCancel()');
		stateHandler.setState({ contentView: null });
	};

	const textDivStyle = { margin: '5px 0', overflowX: 'hidden' };

	return (
		<div>
			<h3>Commit changes</h3>
			<Form
				onSubmit={onSubmit}
				mutators={{
					...arrayMutators
				}}
				initialValues={{ summary: 'Add summary of changes here', description: '' }}
				validate={validateForm}
				render={({
					handleSubmit,
					// form: { mutators: { push } }, // injected from final-form-arrays above
					pristine,
					form,
					submitting
					// values
				}) => {
					return (
						<form onSubmit={handleSubmit} className='sidebar-form'>
							<div style={textDivStyle}>
								Add a short description of your changes
							</div>
							<div style={{ padding: '5px 0' }}>
								{textInputField(
									'summary', false,
									[required, minLength(10), maxLength(50)]
								)}
							</div>
							<div className="buttons">
								<button type="submit" disabled={submitting || pristine}>
									Commit
								</button>
								<button onClick={handleCancel}>Cancel</button>
							</div>
						</form>
					);
				}}
			/>
		</div>
	);

};

// InitProjectModalForm.propTypes = {
// division: PropTypes.object.isRequired,
// editorOptions: PropTypes.object.isRequired
// };

module.exports = InitProjectModalForm;
