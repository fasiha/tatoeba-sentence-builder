/* Usage: node minify-json.js *json */
"use strict";
var util = require('./utilities.js');
var fs = require('fs');
process.argv.slice(2).forEach(function(arg) {
  fs.writeFileSync('min-' + arg, JSON.stringify(util.readJSON(arg)));
});
