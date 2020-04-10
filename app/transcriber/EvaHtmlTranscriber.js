#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
var $;

module.exports = class EvaHtmlTranscriber {

	constructor(projectPath, file) {
		this.htmlFile = path.join(process.cwd(), file);
		this.htmlFileDir = path.dirname(this.htmlFile);
		this.tasksDir = path.join(projectPath, 'tasks'); // should be called activityDir need to fix when merging
		this.procsDir = path.join(projectPath, 'procedures');
		this.imagesDir = path.join(projectPath, 'images');
		this.emptyLines = 0;
		this.nonEmptyLines = 0;
		this.wasCheckboxList = false;
		this.currentTaskTitles = [];
		this.tasks = [];
	}

	/**
	 * Builds maestro directories
	 */
	buildDirectory() {

		if (!fs.existsSync(this.tasksDir)) {
			fs.mkdirSync(this.tasksDir);
		}
		if (!fs.existsSync(this.procsDir)) {
			fs.mkdirSync(this.procsDir);
		}
		if (!fs.existsSync(this.imagesDir)) {
			fs.mkdirSync(this.imagesDir);
		}

		this.basename = path.basename(this.htmlFile, path.extname(this.htmlFile));

		if (!['.html', '.htm'].includes(path.extname(this.htmlFile))) {
			console.error(`${this.htmlFile} does not appear to be an HTML file`);
			process.exit(1);
		}

		if (!fs.existsSync(this.htmlFile)) {
			console.error(`${this.htmlFile} is not a valid file`);
			process.exit(1);
		}

		this.arrayUnique = (value, index, self) => {
			return self.indexOf(value) === index;
		};

		try {
			console.log('Loading HTML');
			$ = cheerio.load(fs.readFileSync(this.htmlFile));
			console.log('HTML loaded');
		} catch (err) {
			throw new Error(err);
		}

	}

	/**
	 * Take an array comprising the three rows of the procedure,
	 * and process it into one or more 'simo'
	 * blocks
	 * @param  {[Array]} rowArray  Array of the form [[col,0,steps], [col,1,steps], [col,2,steps]]
	 * @param  {*} actorKeys       TBD
	 * @return {[string]}          YAML text with at least one simo block
	 */
	createSimoBlocks(rowArray, actorKeys) {

		let rowYamlText = '';

		for (let i = 0; i < rowArray.length; i++) {
			let actorStepsAdded = '';
			for (const line of rowArray[i]) {
				actorStepsAdded += line || '';
			}
			if (actorStepsAdded !== '') {
				// todo handle difference between actorKeys.length and rowArray.length
				rowYamlText += actorKeys[i] + actorStepsAdded;
			}
		}

		// if rowYamlText not empty, it should begin with a simo block
		if (rowYamlText !== '') {
			rowYamlText = '  - simo:\n\n' + rowYamlText;
		}

		return rowYamlText;
	}

	createSyncedSimoBlocks(rowArray, actorKeys) {

		// Don't allow the simo block to have more than this many consecutive
		// steps for a single actor, due to an issue with Word or the npm docx
		// library. Rows are set not to break across a page, but if a row is
		// bigger than one page it _must_ break across a page and currently
		// it does not. Instead, it just disappears beyond the length of the page.
		const maxBlockLength = 20;

		// how many empty lines together to consider it a cluster requiring a sync point
		const emptyLineClusterSize = 2;

		actorKeys = actorKeys.map((val) => {
			return `      ${val}:\n`;
		});

		let index = 0;
		let keepRowing = true;
		let output = '';
		let consecBlanks,
			nextBlock;

		const validStep = function(step) {
			return step && typeof step === 'string' && step.trim() !== '';
		};

		const stepIsSubstep = function(step) {
			if (!step) {
				return false;
			}

			// substeps have at least 6 space in front
			return step.indexOf('          ') === 0;
		};

		const reset = function() {
			consecBlanks = [0, 0, 0];
			nextBlock = [[], [], []];
		};
		reset();

		while (keepRowing) {
			const current = {
				iv: rowArray[0][index],
				ev1: rowArray[1][index],
				ev2: rowArray[2][index]
			};
			const actors = Object.keys(current);

			const next = {
				iv: rowArray[0][index + 1],
				ev1: rowArray[1][index + 1],
				ev2: rowArray[2][index + 1]
			};

			const nextStepContainsSubstep =
				stepIsSubstep(next.iv) || stepIsSubstep(next.ev1) || stepIsSubstep(next.ev2);

			// Push to next block
			for (let i = 0; i < actors.length; i++) {
				const actor = actors[i];
				const step = current[actor];

				if (validStep(step)) {
					nextBlock[i].push(step);
					consecBlanks[i] = 0;
				} else {
					consecBlanks[i]++;
				}
			}

			// When appropriate, push next block to output and reset
			for (let i = 0; i < actors.length; i++) {
				const actor = actors[i];

				if (
					consecBlanks[i] > emptyLineClusterSize && validStep(next[actor]) &&
					!nextStepContainsSubstep
				) {
					output += this.createSimoBlocks(nextBlock, actorKeys);
					reset();
				}

			}

			const longest = nextBlock.reduce(
				(prev, cur) => {
					return cur.length > prev ? cur.length : prev;
				},
				0
			);

			if (longest > maxBlockLength && !nextStepContainsSubstep) {
				output += this.createSimoBlocks(nextBlock, actorKeys);
				reset();
			}

			index++;

			// safety net until this is less kludgy
			if (index > 10000) {
				keepRowing = false;
			}
		}

		if (nextBlock[0].length || nextBlock[1].length || nextBlock[2].length) {
			output += this.createSimoBlocks(nextBlock, actorKeys);
		}

		return output;
	}

	processParagraph(index, paragraphSourceText, colId) {
		const $para = $(paragraphSourceText);
		const images = [];
		$para.find('img').each((i, e) => {
			const $img = $(e);
			const src = $img.attr('src').replace(/%20/g, ' ');
			const srcParts = src.split('/');
			const filename = srcParts[srcParts.length - 1];
			const imagePaths = {
				filename: filename,
				projectImagePath: path.join(this.imagesDir, filename),
				docxImagePath: path.join(this.htmlFileDir, src)
			};
			images.push(imagePaths);
			if (fs.existsSync(imagePaths.projectImagePath)) {
				fs.unlinkSync(imagePaths.projectImagePath); // remove image if it already exists
			}
			fs.copyFileSync(imagePaths.docxImagePath, imagePaths.projectImagePath);
		});

		// todo is that backslash necessary?
		// eslint-disable-next-line no-useless-escape
		const titleRegex = /([A-Z \/&-]+)\((\d{2}:\d{2})\)/;
		let step = $para.text()
			.replace(/"/g, '\\"')
			.replace(/&nbsp;/g, ' ')
			.replace(/\n/g, ' ')
			.replace(/\s+/g, ' ')
			.replace(/EV1/g, '{{ROLE|crewA}}')
			.replace(/EV2/g, '{{ROLE|crewB}}')
			.replace(/Ö/g, '{{CHECK}}')
			.replace(/¬/g, '{{LEFT}}')
			.replace(/®/g, '{{RIGHT}}')
			.replace(/à/g, '{{RIGHT}}')
			.replace(/ß/g, '{{LEFT}}')

		// FIXME
		// ALL these replaces should use regex /thingToReplace/g to replace multiple occurences

		// .replace('�', '')
		// .replace('�', '')
		// .replace('�', '')
		// .replace('�', '')
		// .replace('� ', '...')
		// .replace('�', '') <-- false ellipsis (...)
		// .replace('�', '')
		// .replace('�', '')
		// .replace('���', '')

			.replace(/”/g, '\\"')
			.trim()
			.replace(/^\d+\. /, '')
			.trim();

		const isCheckboxList = step.indexOf('q ') === 0 || step.indexOf('qq') === 0;
		const titleMatch = step.match(titleRegex);

		let paragraphYamlText = '';

		if (step) {
			if (isCheckboxList) {
				step = step.slice(2);
				if (!this.wasCheckboxList) {
					paragraphYamlText += '          checkboxes:\n';
				}
				paragraphYamlText += `            - "${step}"\n`;
				this.wasCheckboxList = true;
			} else {
				if (titleMatch && titleMatch[1].trim()) {
					const duration = titleMatch[2].split(':').map((elem) => {
						return parseInt(elem);
					});
					const title = titleMatch[1].trim();
					const hours = duration[0];
					const minutes = duration[1];
					paragraphYamlText += `        - title: "${title}"\n`;
					paragraphYamlText += '          duration:\n';
					paragraphYamlText += `            hours: ${hours}\n`;
					paragraphYamlText += `            minutes: ${minutes}\n`;
					this.currentTaskTitles.push({
						title: title,
						hours: hours,
						minutes: minutes,
						colId: colId
					});
				} else {
					paragraphYamlText += `        - step: "${step}"\n`;
				}
				this.wasCheckboxList = false;
			}
		}

		if (images.length > 0) {
			// if nothing above generated text, add any images as their own step
			if (paragraphYamlText.trim() === '') {
				paragraphYamlText += '        - images:\n';
			} else {
				paragraphYamlText += '          images:\n';
			}
			for (const img of images) {
				paragraphYamlText += `          - path: "${img.filename}"\n`;
			}
		}

		// if still no text even after images...
		if (paragraphYamlText.trim() === '') {
			this.emptyLines++;
			// console.log('empty line');
			paragraphYamlText = false;
		} else {
			this.nonEmptyLines++;
			// console.log('line not empty');
		}
		return paragraphYamlText;
	}

	/**
 *
 *
 * Start actions. Above and below this point should probably be separated into different files
 *
 *
 */

	getTaskHeader(title, steps, crewAduration, crewBduration) {
		let crewA = '', crewB = '';

		if (crewAduration) {
			crewA = `
  - name: crewA
    description: TBD
    duration:
      minutes: ${crewAduration}
`;
		}

		if (crewBduration) {
			crewB = `
  - name: crewB
    description: TBD
    duration:
      minutes: ${crewBduration}
`;
		}

		if (!crewA && !crewB) {
			throw new Error('need either crew A or crew B');
		}

		return `---
title: "${title}"
roles:
${crewA}

${crewB}

steps:

${steps}
`;
	}

	transcribe() {

		this.buildDirectory();

		$('body > div > div > table, body > div > table').each((t, table) => {

			const head = $(table).children('thead');
			if (!head || head.length === 0) {
				return;
			}

			const colHeaders = [];
			$(table).children('thead').children('tr').children('td').each((i, e) => {
				colHeaders.push($(e).text());
			});

			let colIds;
			if (colHeaders.length === 3) {
				colIds = [
					'IV',
					'crewA',
					'crewB'
				];
			} else {
				colIds = [];
				for (const text of colHeaders) {
					if (text.indexOf('IV') > -1) {
						colIds.push('IV');
					} else if (text.indexOf('EV1') > -1) {
						colIds.push('crewA');
					} else if (text.indexOf('EV2') > -1) {
						colIds.push('crewB');
					} else {
						console.error('CURRENTLY ONLY IV, EV1, EV2 ACTORS ARE SUPPORTED');
					}
				}
			}

			let taskText = '';
			$(table).children('tbody').children('tr').each((r, row) => {
				const rowText = [[], [], []];
				const actorKeys = [];

				$(row).children('td').each((c, col) => {
					const $td = $(col);
					const colspan = $td.attr('colspan');
					let colId;
					if (colspan && colspan > 1) {
						colId = colIds.slice(c, c + colspan).join(' + ');
					} else {
						colId = colIds[c];
					}
					actorKeys.push(colId);

					if (c > 2) {
						console.error(`bad column: ${c}`);
						console.error($(row).text());
					}
					$(col).children('p').each((p, para) => {
						rowText[c].push(this.processParagraph(p, para, colId));
					});
				});

				taskText += this.createSyncedSimoBlocks(rowText, actorKeys);
			});

			if (taskText) {
				let title;
				let minutesByColId;
				if (this.currentTaskTitles.length > 0) {
					minutesByColId = {};
					const allTitles = [];
					for (const subtask of this.currentTaskTitles) {
						allTitles.push(subtask.title);
						for (const cur of subtask.colId.split(' + ')) {
							if (!minutesByColId[cur]) {
								minutesByColId[cur] = 0;
							}
							minutesByColId[cur] += subtask.hours * 60 + subtask.minutes;
						}
					}
					title = allTitles.filter(this.arrayUnique).join(' & ');
				}

				this.currentTaskTitles = []; // reset for next task

				if (!title) {
					title = `Task ${t}`;
				}
				if (!minutesByColId) {
					minutesByColId = { crewA: 30, crewB: 30 };
				}
				this.tasks[t] = {
					fileContent: this.getTaskHeader(
						title,
						taskText,
						minutesByColId.crewA,
						minutesByColId.crewB
					),
					title: title
				};
			}

		});

		var procedure = `procedure_name: ${this.basename}

columns:

  - key: IV
    display: IV/SSRMS/MCC
    actors: "*"

  - key: EV1
    actors: EV1
    display: EV1

  - key: EV2
    actors: EV2
    display: EV2


tasks:
`;

		const taskColors = [
			'#D6D6D6',
			'#F0F8FF',
			'#F0F8FF',
			'#F0F8FF',
			'#FFDEAD',
			'#FFDEAD',
			'#FFDEAD',
			'#DEB887',
			'#DEB887',
			'#DEB887',
			'#9AFF9A',
			'#9AFF9A',
			'#9AFF9A',
			'#9AFF9A',
			'#FFBBFF',
			'#FFBBFF',
			'#FFBBFF',
			'#D3D3D3'
		];
		for (let t = 0; t < this.tasks.length; t++) {
			if (!this.tasks[t] || !this.tasks[t].fileContent) {
				continue;
			}
			let color;
			if (t === 0 || t === this.tasks.length - 1) {
				color = '#D6D6D6';
			} else {
				color = taskColors[t] || taskColors[taskColors.length - 1];
			}

			// todo fixme use filenameify or whatever it's called
			const taskFileName = `${this.basename}-${this.tasks[t].title.replace(/\//g, '-').replace(/\\/g, '-')}.yml`;
			const taskFilePath = path.join(this.tasksDir, taskFileName);
			fs.writeFileSync(taskFilePath, this.tasks[t].fileContent);
			procedure += `
  - file: ${taskFileName}
    roles:
      crewA: EV1
      crewB: EV2
    color: "${color}"
`;

		}

		fs.writeFileSync(path.join(this.procsDir, `${this.basename}.yml`), procedure);
		console.log(`empty lines = ${this.emptyLines}, non-empty = ${this.nonEmptyLines}`);
		console.log('complete!');

	}

};
