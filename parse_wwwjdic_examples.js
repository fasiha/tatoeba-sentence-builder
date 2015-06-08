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

var sentences = util.read('data/wwwjdic.csv')
                    .trim()
                    .split('\n')
                    .map(function(line, lineNumber) {
                      var fields = line.trim().split('\t');
                      // 0, 1 are numbers

                      var o = {};
                      o.japanese = fields[2];

                      o.english = fields[3];

                      o.num = lineNumber;

                      o.tags = fields[4].split(' ').map(function(code) {
                        var headword, reading = "", sense = 0, form = "", good;

                        // Strip (reading)
                        code = code.replace(/\((.+)\)/, function(full, match) {
                          reading = match;
                          return '';
                        });

                        // Strip [sense #]
                        code =
                            code.replace(/\[([0-9]+)\]/, function(full, match) {
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

                        // All that should remain is the headword, and ~, which
                        // is stripped.
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

// Write normalized JSON/LDJSON files.
var normalizedSentences =
    sentences.map(function(obj) { return _.omit(obj, 'tags'); });
util.writeJSON('wwwjdic-sentences.json', normalizedSentences);
util.writeJSON('wwwjdic-tags.json', tags);
util.writeJSON('wwwjdic-good-tags.json', goodTags);

util.writeLineDelimitedJSON('data-static/wwwjdic-sentences.ldjson',
                            normalizedSentences);
util.writeLineDelimitedJSON('data-static/wwwjdic-tags.ldjson', tags);
util.writeLineDelimitedJSON('data-static/wwwjdic-good-tags.ldjson', goodTags);

// Write non-normalized JSON
var noNumSentences =
    sentences.map(function(obj) { return _.omit(obj, 'num'); });
util.writeLineDelimitedJSON('wwwjdic-sentences-nonnormalized.ldjson',
                            noNumSentences);

if (true) {
  console.log(
      "Run\n$ " +
      "rethinkdb import -f wwwjdic-sentences-nonnormalized.ldjson --table " +
      config.dbName + "." + config.examplesTable + " --force");
} else {
  // To RethinkDB: get all sentences from it, and add the sentences that aren't
  // already there (only look at Japanese & English parts of the sentence). For
  // those that are already in db, don't touch them.
  var r = require('rethinkdb');
  var config = require('./config');

  var examplesTable = config.examplesTable;

  var connection = null;
  r.connect({host : config.dbHost, port : config.dbPort})
      .then(function(c) {
        connection = c;
        console.log("Getting all rows out of db.");
        return r.db(config.dbName)
            .table(examplesTable)
            .pluck('japanese', 'english')
            .run(connection);
      })
      .then(function(cursor) { return cursor.toArray(); })
      .then(function(arr) {
        console.log("Got " + arr.length + " entries from db.");

        var hash = function(o) { return o.japanese + o.english; };
        var db = _.object(arr.map(hash));
        var onlyNew =
            noNumSentences.filter(function(obj) { return !(hash(obj) in db); });

        console.log("Inserting " + onlyNew.length + " new sentences.");
        return r.db(config.dbName)
            .table(examplesTable)
            .insert(onlyNew)
            .run(connection);
      })
      .then(function() {
        console.log("All done.");
        return connection.close();
      })
      .catch(console.error.bind(console, 'Error thrown!'));
}
