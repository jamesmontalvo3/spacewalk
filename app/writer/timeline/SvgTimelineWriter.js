'use strict';

const fs = require('fs');
const svg2img = require('svg2img');
const envHelper = require('../../helpers/envHelper');
const objectHelper = require('../../helpers/objectHelper');
const TimelineWriter = require('./TimelineWriter');

/**
 * Add rectangle to SVG object
 * @param {SVG} canvas   SVG object
 * @param {Object} opts  Object with width, height, x, and y props required. stroke and fillColor
 *                       optional.
 */
function addBox(canvas, opts = {}) {
	objectHelper.requireProps(opts, ['width', 'height', 'x', 'y']);
	objectHelper.defaults(opts, {
		stroke: '#000',
		fillColor: '#000'
	});

	canvas
		.rect(opts.width, opts.height)
		.stroke(opts.stroke)
		.move(opts.x, opts.y)
		.fill(opts.fillColor);
}

/**
 * Add text to SVG object
 * @param {SVG} canvas       SVG object
 * @param {Object} opts      Object with all optional properties
 * @param {Function} textFn
 */
function addText(canvas, opts, textFn) {
	objectHelper.defaults(opts, {
		text: '<placeholder text>',
		x: 0,
		y: 0,
		color: '#000',
		family: 'Arial',
		size: 12,
		weight: 'normal',
		anchor: 'start',
		leading: 1.3
	});

	const text = textFn || opts.text;

	// Add the text to the canvas
	canvas
		.text(text)
		.move(opts.x, opts.y)
		.font({
			fill: opts.color,
			family: opts.family,
			size: opts.size,
			weight: opts.weight,
			anchor: opts.anchor,
			leading: opts.leading
		});

}

/**
 * Get x-coordinate of the left edge of a column in pixels
 *
 * @param {TimelineWriter} writer  Instance of TimelineWriter
 * @param {number} columnIndex     Index of the column
 * @return {number}             Pixels of the left edge of the column
 */
function getColumnLeft(writer, columnIndex) {
	return writer.sidebarWidth + columnIndex * writer.colWidth;
}

/**
 * Add Activity SVG timeline
 *
 * @param {SvgTimelineWriter} writer
 * @param {number} columnIndex        Which column in the timeline to insert Activity into
 * @param {Task} task
 * @param {string} actor
 */
function addActivity(writer, columnIndex, task, actor) {

	const canvas = writer.canvas;

	const boxOpts = {
		width: writer.colWidth,
		height: writer.minutesToPixels(task.actorRolesDict[actor].duration.getTotalMinutes()),
		x: getColumnLeft(writer, columnIndex),
		y: writer.headerRowY + writer.minutesToPixels(
			task.actorRolesDict[actor].startTime.getTotalMinutes()
		)
	};
	boxOpts.stroke = '#000';
	boxOpts.fillColor = task.taskReqs.color || '#F0FFFF';

	addBox(canvas, boxOpts);

	const textOpts = {
		x: boxOpts.x + writer.leftTextMargin,
		y: boxOpts.y + writer.topTextMargin,
		color: '#000',
		family: 'Arial',
		size: 12 // potentially adjusted smaller below logic below
	};

	if (boxOpts.height < 16) {
		textOpts.size = 8;
	} else if (boxOpts.height < 22) {
		textOpts.y = textOpts.y - 6; // box getting too short, make more room
	}

	addText(canvas, textOpts, function(add) {
		if (boxOpts.height > 10) {
			// todo Add underline here
			// todo ref: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/text-decoration
			// todo unknown if current SVG library supports underline
			add.tspan(task.title.toUpperCase());
			add.tspan(` (${task.actorRolesDict[actor].duration.format('H:M')})`);
		}
	});

}

/**
 * Add header to SVG
 *
 * @param {SvgTimelineWriter} writer
 * @param {number} columnIndex
 * @param {string} headerText
 */
function addColumnHeader(writer, columnIndex, headerText) {

	const canvas = writer.canvas;
	const xLeft = getColumnLeft(writer, columnIndex);

	const boxOpts = {
		width: writer.colWidth,
		height: writer.headerRowY,
		x: xLeft,
		y: 0,
		stroke: '#000',
		fillColor: 'white'
	};

	addBox(canvas, boxOpts);

	const textOpts = {
		text: headerText.toUpperCase(),
		x: xLeft + writer.leftTextMargin + Math.floor(writer.colWidth / 2),
		y: Math.floor((writer.headerRowY - writer.headerTextSize) / 2),
		color: '#000',
		family: 'Arial',
		size: writer.headerTextSize,
		weight: 'bold',
		anchor: 'middle',
		leading: 0
	};

	addText(canvas, textOpts);

}

/**
 * Add markings to side of timeline based upon how long the timeline is.
 *
 * @param {SvgTimelineWriter} writer
 */
function addTimelineMarkings(writer) {

	const canvas = writer.canvas;

	// how many half-hour segments to generate
	const halfHours = Math.ceil(writer.totalMinutes / 30);

	for (let i = 0; i <= halfHours; i++) {

		const isHour = (i % 2) === 0;

		// eslint-disable-next-line no-restricted-properties
		const hours = Math.floor(i / 2).toString().padStart(2, '0');
		const minutes = isHour ? ':00' : ':30';
		const timeString = hours + minutes;

		// line sticks out further from sidebar on hours than on half-hours
		const tickLength = isHour ? writer.tickLengthMajor : writer.tickLengthMinor;

		// start and end coordinates for each line
		const y = writer.headerRowY + writer.minutesToPixels(i * 30);
		const rightX = writer.sidebarWidth + (writer.numColumns * writer.colWidth) + tickLength;
		const leftX = writer.sidebarWidth - tickLength;

		// draws a line across the whole timeline, from left sidebar to right sidebar
		canvas
			.line(leftX, y, rightX, y)
			.stroke({
				width: 1,
				color: 'black'
			});

		const textOptions = {
			text: timeString,
			x: 5,
			y: y - 3,
			fill: 'black',
			family: 'Arial',
			size: 11,
			leading: -1
		};

		// left sidebar marking text
		addText(canvas, textOptions);

		// right sidebar marking text
		textOptions.x = writer.imageWidth - 28; // same text, just shift the x coordinate
		addText(canvas, textOptions);

	}

}

module.exports = class SvgTimelineWriter extends TimelineWriter {

	/**
	 * Generate the actual timeline SVG. This is broken into its own function rather than being done
	 * in the constructor because the construct will likely be generalized for multiple timeline
	 * formats, not just SVG, but the code below is SVG-specific.
	 *
	 * @return {string} SVG's XML
	 */
	create() {

		// If in a browser context (electron or other) use native window object
		if (typeof window !== 'undefined' && window.isElectron || envHelper.isBrowser) {

			const { SVG } = require('@svgdotjs/svg.js');
			this.canvas = SVG().size(this.imageWidth, this.imageHeight);

		// In Node context, fabricate a window object
		} else {
			// svgdom returns 'new Window()'. We don't want to get a reference to the same Window
			// object on all uses. We want a new window each time. Get the Window constructor and
			// construct our own new Window.
			const WindowConstructor = require('svgdom').constructor;
			const window = new WindowConstructor();

			// When SVG timeline extends generic timeline, move this to top of file
			const document = window.document;
			const { SVG, registerWindow } = require('@svgdotjs/svg.js');

			// register window and document
			registerWindow(window, document);

			// create canvas
			this.canvas = SVG().size(this.imageWidth, this.imageHeight);
		}

		// Create the underlying lines and text for the timeline (not tasks themselves)
		addTimelineMarkings(this);

		// Create the headers for each column
		this.columns.forEach((actor, index) => {
			const headerDisplay = this.procedure.ColumnsHandler.getColumnDisplayTextByActor(actor);
			addColumnHeader(this, index, headerDisplay);
		});

		// Add tasks to the timeline
		for (const task of this.procedure.tasks) {
			for (const actor in task.actorRolesDict) {
				const columnIndex = this.actorToTimelineColumn[actor];
				addActivity(this, columnIndex, task, actor);
			}
		}

		return this.canvas.svg();
	}

	writeSVG(filename) {
		fs.writeFileSync(filename, this.canvas.svg());
	}

	writePNG(filename, callback) {
		const dimensions = {
			width: this.imageWidth,
			height: this.imageHeight,
			preserveAspectRatio: true
		};
		svg2img(
			this.canvas.svg(),
			dimensions,
			function(error, buffer) {
				if (error) {
					throw error;
				}
				const isBase64 = typeof buffer.indexOf === 'function' &&
					buffer.indexOf('data:image/png;base64,') !== -1;

				if (isBase64) {
					buffer = buffer.replace(/^data:image\/png;base64,/, '');
				}

				const options = isBase64 ? { encoding: 'base64' } : undefined;

				fs.writeFileSync(filename, buffer, options);
				callback(dimensions);
			}
		);
	}

};
