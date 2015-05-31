"use strict";
var utils = require('./nodeUtilities.js');

var core = utils.read('routledge_data.md').trim().replace(/\r/g, '').split('\n\n');
if (core.length !== 5000) {
  console.error('ERROR: Core5k document has ' + core.length +
                ' elements, not 5000.');
}

utils.writeJSON('core5k.json', core);

/*
var docs = core.map(function(entry, num) {
  var lines = entry.split('\n');
  var freqDisp = lines[2].split(' | ');
  var o = {};
  o.number = num + 1;
  o.frequency = freqDisp[0];
  o.dispersion = freqDisp[1];
});
*/
