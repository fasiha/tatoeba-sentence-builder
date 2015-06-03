"use strict";
var util = require('./nodeUtilities.js');
var _ = require('lodash');

var tags = {};
var goodTags = {};
function insertIntoHash(hash, headword, sense, lineNumber) {
  if (!(headword in hash)) {
    var insert = {};
    insert[sense] = [lineNumber];
    hash[headword] = insert;  // can't use {"sense" : ...} here
  } else if (!(sense in hash[headword])) {
    hash[headword][sense] = [lineNumber];
  } else {
    hash[headword][sense].push(lineNumber);
  }
}

var sentences =
    util.read('data/wwwjdic.csv').trim().split('\n').map(
        function(line, lineNumber) {
          var fields = line.trim().split('\t');
          // 0, 1 are numbers

          var o = {};
          o.japanese = fields[2];

          o.english = fields[3];

          o.number = lineNumber;

          var thisTags = fields[4].split(' ').map(function(code) {
            var headword, reading = null, sense = null, form = null, good = null;

            // Strip (reading)
            code = code.replace(/\((.+)\)/, function(full, match) {
              reading = match;
              return '';
            });

            // Strip [sense #]
            code = code.replace(/\[([0-9]+)\]/, function(full, match) {
              sense = +match;
              return '';
            });

            // Strip {form in sentence used}
            code = code.replace(/{(.+)}/, function(full, match) {
              form = match;
              return '';
            });

            // Find indicator for verified good example
            good = code.search('~') >= 0;

            // All that should remain is the headword, and ~, which is stripped.
            headword = good ? code.replace('~', '') : code;

            // Now, the fun can begin!
            insertIntoHash(tags, headword, sense, lineNumber);
            if (good) {
              insertIntoHash(goodTags, headword, sense, lineNumber);
            }

            return {
              headword : headword,
              reading : reading,
              sense : sense,
              form : form,
              good : good
            };
          });
          // This return value isn't used currently. This map is used to update
          // `tags` global.

          return o;
        });

// Strip duplicates
_.keys(tags).forEach(function(headword) {
  _.keys(tags[headword])
      .forEach(function(sense) {
        tags[headword][sense] = _.uniq(tags[headword][sense]);
        // FIXME can we use _.uniq(..., isSorted=true)?
      });
});

// Write
util.writeJSON('wwwjdic-sentences.json', sentences);
util.writeJSON('wwwjdic-tags.json', tags);
util.writeJSON('wwwjdic-good-tags.json', goodTags);

util.writeLineDelimitedJSON('data-static/wwwjdic-sentences.ldjson', sentences);
util.writeLineDelimitedJSON('data-static/wwwjdic-tags.ldjson', tags);
util.writeLineDelimitedJSON('data-static/wwwjdic-good-tags.ldjson', goodTags);

