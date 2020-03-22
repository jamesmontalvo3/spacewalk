// Taken from https://github.com/Zettlr/Zettlr/blob/master/scripts/get-pkg-version.js
// This script file simply outputs the version in the package.json.
// It is used as a helper by the make.sh-script to retrieve the version.
const path = require('path');
const file = process.argv[2] === '--lock' ? 'package-lock.json' : 'package.json';
console.log(require(path.join(__dirname, `../../${file}`)).version);
