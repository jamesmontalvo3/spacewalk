'use strict';

/**
 * Callback for adding two numbers.
 *
 * @callback imageDataReadyCallback
 * @param {boolean|Object} error - Error or false (currently no error handling)
 * @param {string} imageDataUrl - Base64 image data to be inserted into <img src="<here>" /> or
 *                                otherwise handled.
 */

/**
 *
 * @param {string} svgAsXML - XML string representation of the SVG
 * @param {Object} dimensions - Like { width: 900, height: 500 }
 * @param {imageDataReadyCallback} callback - Function to call when image data is ready
 */
function browserNativeSvgToImg(svgAsXML, dimensions, callback) {

	const can = document.createElement('canvas'); // Not shown on page
	const ctx = can.getContext('2d');

	const loader = new Image(); // Not shown on page
	loader.width = can.width = dimensions.width;
	loader.height = can.height = dimensions.height;

	loader.onload = function() {
		ctx.drawImage(loader, 0, 0, loader.width, loader.height);
		callback(
			false, // no error. this arg is required to match svg2img interface.
			can.toDataURL()
		);
	};

	loader.src = 'data:image/svg+xml,' + encodeURIComponent(svgAsXML);
}

module.exports = browserNativeSvgToImg;
