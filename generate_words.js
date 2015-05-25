var fs = require('fs');
var lo = require('lodash');

// words-only.txt has 5000 lines, each of which contains a full-width-comma separated
// list of words, as well as some words with optional suffixes (e.g.,
// `仕事（する）`).
// This will create a arrays of 5000 arrays, where commas have been split and
// optional suffixes added (i.e., 仕事（する） => ["仕事", "仕事する"]).
var words = fs.readFileSync('words-only.txt', {encoding : 'utf-8'})
                .trim()
                .split('\n')
                .map(function(l) {
  return l.trim().split('，').map(function optionalToArray(l) {
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
// For the scraper, we only care about the words, not about their ordering:
var core = lo.flattenDeep(words);
fs.writeFileSync("words-only.json", JSON.stringify(core, null, 1));

// But later we'll be interested in the order:
fs.writeFileSync("ordered-words.json", JSON.stringify(words, null, 1));

