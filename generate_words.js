"use strict";
var lo = require('lodash');
var util = require('./nodeUtilities.js');

// words-only.txt has 5000 lines, each of which contains a full-width-comma separated
// list of words, as well as some words with optional suffixes (e.g.,
// `仕事（する）`).
// This will create a arrays of 5000 arrays, where commas have been split and
// optional suffixes added (i.e., 仕事（する） => ["仕事", "仕事する"]).
var words = util.read('words-only.txt').trim().split('\n').map(function(line) {
  return line.trim().split('，').map(function optionalToArray(l) {
    var found = l.match('（[^）]*）');
    if (!found) {
      return l;
    }
    var withOptional = l.replace(/（/, '').replace(/）/, '');
    var noOptional = l.replace(found[0], '');
    return lo
        .flatten([ optionalToArray(withOptional), optionalToArray(noOptional) ]);
  });
}).map(lo.flatten);
// Sometimes we only care about the words, not about their ordering:
var core = lo.flattenDeep(words);
util.writeJSON("words-only.json", core);

// But later we'll be interested in the order:
util.writeJSON("ordered-words.json", words);

