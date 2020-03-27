const odfToMaestroMap = {
	'odf-checkmark': '{{CHECK}}',
	'placedholder-1': '{{CHECKBOX}}',
	'placeholder-2': '{{CHECKEDBOX}}',
	'odf-right-arrow': '{{RIGHT}}',
	'odf-left-arrow': '{{LEFT}}',
	'odf-up-arrow': '{{UP}}',
	'odf-down-arrow': '{{DOWN}}',
	'odf-disconnect-symbol': '{{DISCONNECT}}',
	'odf-connect-symbol': '{{CONNECT}}',
	'odf-clockwise-sign': '{{CLOCKWISE}}',
	'odf-counterclockwise-sign': '{{COUNTERCLOCKWISE}}',
	nbsp: ' '
};
const maestroToOdfMap = {};

for (const odfText in odfToMaestroMap) {
	const maestroText = odfToMaestroMap[odfText];
	maestroToOdfMap[maestroText] = odfText;
}
module.exports = {
	/**
     *
     * @param {string} odfText  odf symbol text used in IPV XML file
     * @return {string}         equivalent maestro symbol
     */
	odfToMaestro: function(odfText) {
		return odfToMaestroMap[odfText];
	},
	/**
     *
     * @param {string} maestroText maestro symbol
     * @return {string}            odf symbol equivalent
     */
	maestroToOdf: function(maestroText) {
		return maestroToOdfMap[maestroText];
	}

};
