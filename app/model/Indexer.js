'use strict';

const typeHelper = require('../helpers/typeHelper');

module.exports = class Indexer {

	constructor() {
		this.index = {};
	}

	add(item, type = null) {
		if (this.index[item.uuid]) {
			console.error(`Duplicated uuid for ${item.uuid}`);
			console.error('Current item in index', this.index[item.uuid]);
			console.error('New item', item);
			throw new Error('No duplicate uuid allowed');
		}

		if (!type && item.constructor && item.constructor.name) {
			type = item.constructor.name;
		}
		this.index[item.uuid] = { item, type };
	}

	alter(uuid, changes) {
		this.existOrError(uuid);

		const record = this.index[uuid];
		for (const key in changes) {
			// must be string, number, bool, etc. Indexer doesn't hold objects for now, other than
			// the .item added with add()
			if (!typeHelper.is(changes[key], 'scalar', 'falsy')) {
				console.log('invalid record property type:', changes[key]);
				throw new Error('Indexer can only add scalar properties to records');
			}

			if (record[key] !== changes[key]) {
				record[key] = changes[key];
			}
			// todo: add subscriptions
		}
	}

	get(uuid) {
		return this.index[uuid];
	}

	extract(uuid) {
		const record = this.index[uuid];
		const { prevUuid, nextUuid } = record;
		if (record.prevUuid && record.nextUuid) {
			this.alter(record.prevUuid, { nextUuid: record.nextUuid });
			this.alter(record.nextUuid, { prevUuid: record.prevUuid });
		} else if (record.prevUuid) {
			this.alter(record.prevUuid, { nextUuid: null });
		} else if (record.nextUuid) {
			this.alter(record.nextUuid, { prevUuid: null });
		}
		this.alter(uuid, { prevUuid: null, nextUuid: null });

		return { prevUuid, nextUuid }; // return these for triggering updates
	}

	insert(uuid, direction, targetUuid) { // was insertAfterUuid
		if (['after', 'before'].indexOf(direction) === -1) {
			throw new Error('Indexer.insert() requires direction to be "after" or "before"');
		}
		this.existOrError(targetUuid);

		// setup where nextUuid and prevUuid should be used
		const insertedDirection = (direction === 'after') ? 'nextUuid' : 'prevUuid';
		const oppositeDirection = (direction === 'after') ? 'prevUuid' : 'nextUuid';

		this.extract(uuid); // remove the inserting item from its current location

		const targetRecord = this.index[targetUuid];

		// the record before or after the target record, if it exists. Inserted record will be in
		// between target and adjacent
		const adjacentUuid = targetRecord[insertedDirection];
		const adjacentRecord = this.index[adjacentUuid];

		// connect the target to the inserting in the inserted direction
		const targetChange = {};
		targetChange[insertedDirection] = uuid;

		// connect the inserted to the target in the opposite direction
		const insertingChange = {};
		insertingChange[oppositeDirection] = targetUuid;

		if (adjacentRecord) {
			// connect the inserted to the adjacent in the inserted direction
			insertingChange[insertedDirection] = adjacentUuid;

			// connect the adjacent to the inserted and perform the index alteration
			const adjacentChange = {};
			adjacentChange[oppositeDirection] = uuid;
			this.alter(adjacentUuid, adjacentChange);
		}

		// perform alterations
		this.alter(targetUuid, targetChange);
		this.alter(uuid, insertingChange);
	}

	delete(uuid) {
		const prevAndNext = this.extract(uuid);
		delete this.index[uuid];

		return prevAndNext;
	}

	after(uuid) {
		this.existOrError(uuid);

		let record = this.index[uuid];
		const found = {};
		found[uuid] = true;
		const list = [];
		while (record.nextUuid) {
			const currentUuid = record.nextUuid;

			if (found[currentUuid]) {
				throw new Error('Loop found');
			}
			record = this.index[currentUuid];
			list.push(currentUuid);
			found[currentUuid] = true;
		}
		return list;
	}

	existOrError(uuid) {
		if (!this.index[uuid]) {

			throw new Error(`${uuid} does not exist in this index`);
		}
	}

	earlier(uuid1, uuid2) {
		if (uuid1 === uuid2) {
			return uuid1;
		}
		const after1 = this.after(uuid1);
		if (after1.indexOf(uuid2) > -1) {
			return uuid1;
		}
		const after2 = this.after(uuid2);
		if (after2.indexOf(uuid1) > -1) {
			return uuid2;
		}
		throw new Error(`Cannot determine earlier item of ${uuid1} and ${uuid2}`);
	}

};
