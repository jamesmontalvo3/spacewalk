const path = require('path');
const React = require('react');
const { Form } = require('react-final-form');
const arrayMutators = require('final-form-arrays').default;
const fs = require('fs'); // FIXME make this work in web (this will be electron specific)

const stateHandler = require('../../state/index');
const yamlFileNamify = require('../../../helpers/yamlFileNamify');

const { textInputField, validators } = require('./formInputTypes');
const { required, minLength } = validators;

const InitProjectModalForm = () => {

	// validate={insertFunction}
	const validateForm = (values) => {
		const errors = {};

		const parentPath = stateHandler.state.initProjectParentPath;
		const newProjectPath = path.join(parentPath, values.projectName);

		console.log('contents of parent path', fs.readdirSync(parentPath));

		if (fs.existsSync(newProjectPath)) {
			const msg = `"${values.projectName}" already exists in this location`;
			console.log(msg);
			errors.projectName = msg;
		} else {
			console.log(`No preexisting directory at ${values.projectName} - go for creation`);
		}

		return errors;
	};

	const onSubmit = (values) => {
		const parentPath = stateHandler.state.initProjectParentPath;
		console.log(`Creating directory ${values.projectName} in ${parentPath}`);
		const program = window.maestro.app;

		const newProjectPath = path.join(parentPath, values.projectName);

		// make newProjectPath dir and procedures and tasks sub-dirs
		try {
			fs.mkdirSync(newProjectPath);
			fs.mkdirSync(path.join(newProjectPath, 'procedures'));
			fs.mkdirSync(path.join(newProjectPath, 'tasks'));
			fs.mkdirSync(path.join(newProjectPath, 'images'));
			fs.writeFileSync(path.join(newProjectPath, '.gitignore'), 'build/*');
		} catch (err) {
			console.error(err); // need a way to "console.error() to the UI"
			return;
		}

		const firstTaskName = 'Egress/Setup';
		const procedureFileName = yamlFileNamify(values.projectName);
		const firstTaskFileName = yamlFileNamify(firstTaskName);

		const definition = {
			procedureDefinition: {
				// eslint-disable-next-line camelcase
				procedure_name: values.projectName,
				columns: [
					{ key: 'IV', actors: ['*'], display: 'IV/SSRMS/MCC' },
					{ key: 'EV1', actors: ['EV1'], display: 'EV1' },
					{ key: 'EV2', actors: ['EV2'], display: 'EV2' }
				],
				tasks: [
					{
						file: firstTaskFileName,
						roles: {
							crewA: 'EV1',
							crewB: 'EV2'
						}
					}
				]
			},
			taskDefinitions: {}
		};

		definition.taskDefinitions[firstTaskFileName] = {
			title: firstTaskName,
			roles: [
				{ name: 'crewA', duration: { minutes: 30 } },
				{ name: 'crewB', duration: { minutes: 30 } }
			],
			steps: [
				{ simo: {
					IV: [{ text: 'One small step' }],
					crewA: [{ text: 'One small step' }],
					crewB: [{ text: 'One small step' }]
				} }
			]
		};

		program.loadProcedureFromDefinition(newProjectPath, procedureFileName, definition);

		stateHandler.saveProcedureChange();
		stateHandler.saveChange(0); // save the one and only task, index 0

		// FIXME this synchronous function happens before the above async functions are complete
		window.maestro.initGitRepoAndFirstCommit(newProjectPath);

		stateHandler.setState({
			modalVisible: false,
			modalType: 'NONE',
			initProjectParentPath: null
		});
	};

	const textDivStyle = { margin: '5px 0', overflowX: 'hidden' };

	return (
		<div>
			<Form
				onSubmit={onSubmit}
				mutators={{
					...arrayMutators
				}}
				initialValues={{ projectName: 'New Project' }}
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
								What would you like to call your project?
							</div>
							<div style={{ padding: '5px 0' }}>
								{textInputField('projectName', 'Project Name', [required, minLength(3)])}
							</div>
							<div style={textDivStyle}>
								Creating new directory within:
							</div>
							<div style={textDivStyle}>
								{stateHandler.state.initProjectParentPath}
							</div>
							<div className="buttons">
								<button type="submit" disabled={submitting || pristine}>
									Create
								</button>
								<button onClick={this.close}>Cancel</button>
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
