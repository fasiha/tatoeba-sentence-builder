"use strict";
var utils = require('./nodeUtilities.js');
var _ = require('lodash');
var XRegExp = require('XRegExp').XRegExp;

var regexps = {
  kanji : XRegExp('\\p{Han}', 'g'),
  katakana : XRegExp('\\p{Katakana}', 'g'),
  hiragana : XRegExp('\\p{Hiragana}', 'g'),
  total : /./g
};

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

var sentences = utils.read('data/wwwjdic.csv')
                    .trim()
                    .split('\n')
                    .map(function(line, lineNumber) {
                      var fields = line.trim().split('\t');
                      // 0, 1 are numbers

                      var o = {};
                      o.japanese = fields[2];
                      o.numChars = _.mapValues(regexps, function(re) {
                        var list = o.japanese.match(re);
                        return list ? list.length : 0;
                      });

                      o.english = fields[3];

                      o.source = {
                        num : lineNumber,
                        name : "Tatoeba corpus",
                        num1 : +fields[0],
                        num2 : +fields[1]
                      };

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

// Time-tag
sentences = utils.withDate(sentences);

// Write normalized LDJSON files
utils.writeLineDelimitedJSON('data-static/wwwjdic-sentences.ldjson',
                             sentences.map(function(obj) {
                               return _.omit(obj, 'tags');
                             }));
utils.writeLineDelimitedJSON('data-static/wwwjdic-tags.ldjson', tags);
utils.writeLineDelimitedJSON('data-static/wwwjdic-good-tags.ldjson', goodTags);

// Write non-normalized JSON
utils.writeLineDelimitedJSON('wwwjdic-sentences-nonnormalized.ldjson',
                            sentences);

var config = require('./config');
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
            sentences.filter(function(obj) { return !(hash(obj) in db); });

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
