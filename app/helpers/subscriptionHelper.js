'use strict';

module.exports = {

	subscribe: function(subscriberFn, subscriberFnArray) {
		subscriberFnArray.push(subscriberFn);

		// return unsubscribe function
		return () => {
			subscriberFnArray = subscriberFnArray.filter((fn) => fn !== subscriberFn);
		};
	},

	run: function(subscriberFnArray, ...argsPassedToSubscriberFn) {
		subscriberFnArray.forEach((subsciberFn) => {
			if (typeof subsciberFn !== 'function') {
				throw new Error('Subscriber functions must be _functions_.');
			}
			subsciberFn(...argsPassedToSubscriberFn);
		});
	}
};
