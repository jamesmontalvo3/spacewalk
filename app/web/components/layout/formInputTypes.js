const React = require('react');
const { Field } = require('react-final-form');

const required = (value) => (value ? undefined : 'Required');
const mustBeNumber = (value) => (isNaN(value) ? 'Must be a number' : undefined);

const numOrUndefined = (value) => (typeof value === 'undefined' || !isNaN(value) ?
	undefined : 'Must be a number or left blank');

const minValue = (min) => (value) =>
	isNaN(value) || value >= min ? undefined : `Should be greater than ${min}`;
const isZeroish = (value) => (!value || value === 0 || value === '0' ? 'Should be zero' : undefined);
const isRGBstring = (value) => (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ?
	undefined : 'Must be a color string');
const minLength = (min) => (value) => (typeof value === 'string' && value.length >= min ?
	undefined : `Must be at least ${min} characters`);
const maxLength = (max) => (value) => (typeof value === 'string' && value.length <= max ?
	undefined : `Must be at no more than ${max} characters`);

const composeValidators = (...validators) => (value) =>
	validators.reduce((error, validator) => error || validator(value), undefined);

const showValidationErrors = (meta) => {
	return meta.error && meta.touched ?
		(<div style={{ fontWeight: 'bold', color: 'red', textAlign: 'right' }}>
			{meta.error}
		</div>) : null;
};

const textInputField = (name, label = false, validators = [], style = {}) => {
	return <Field
		name={name}
		validate={composeValidators(...validators)}
	>
		{({ input, meta }) => (
			<React.Fragment>
				<div className='field-row'>
					{ label ? <label>{label}</label> : null }
					<input
						{...input}
						className={meta.error && meta.touched ? 'error' : null }
						type="text"
						style={style}
					/>
				</div>
				{showValidationErrors(meta)}
			</React.Fragment>
		)}
	</Field>;
};

const checkboxInputField = (
	name, value = true, label = false, validators = [], style = {}
) => {

	return <Field
		name={name}
		validate={composeValidators(...validators)}
		value={value}
		type='checkbox'
	>
		{({ input, meta }) => (
			<React.Fragment>
				<div className='field-row'>
					{ label ? <label>{label}</label> : null }
					<input
						{...input}
						// value={value}
						className={meta.error && meta.touched ? 'error' : null }
						type="checkbox"
						style={style}
						// defaultChecked={checked}
					/>
				</div>
				{showValidationErrors(meta)}
			</React.Fragment>
		)}
	</Field>;
};

const selectInputField = (name, children, label = false, validators = []) => {
	return <Field
		name={name}
		validate={composeValidators(...validators)}
	>
		{({ input, meta }) => (
			<React.Fragment>
				<div className='field-row'>
					{ label ? <label>{label}</label> : null }
					<select
						{...input}
						name={name}
					>
						{children}
					</select>
				</div>
				{showValidationErrors(meta)}
			</React.Fragment>
		)}
	</Field>;
};

const durationInput = (name1, name2, label) => {
	return <div className='field-row'>
		<label>{label}</label>
		{textInputField(name1, false, [numOrUndefined, minValue(0)], { width: '50px' })}
		&nbsp;:&nbsp;
		{textInputField(name2, false, [numOrUndefined, minValue(0)], { width: '50px' })}
	</div>;
};

module.exports = {
	durationInput,
	selectInputField,
	textInputField,
	checkboxInputField,
	showValidationErrors,
	validators: {
		required,
		mustBeNumber,
		numOrUndefined,
		minValue,
		isZeroish,
		isRGBstring,
		minLength,
		maxLength
	}
};
