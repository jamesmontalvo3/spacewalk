/** import async WASM code */

let wasmModule;
// const { STN } = require('../../crate/pkg');

/**
 * Get the collection of STN tools written in Rust/WASM.
 * @return {Promise<{STN: STN, Interval: Interval}>}
 */
module.exports = () => new Promise((resolve, reject) => {
	if (wasmModule) {
		resolve(wasmModule);
		return;
	}

	import('../../crate/pkg')
		.then((m) => {
			wasmModule = m;
			resolve(m);
		})
		.catch((e) => {
			console.error('Unable to import STN module from WASM');
			reject(e);
		});
});
