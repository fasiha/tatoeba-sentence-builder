"use strict";
var lo = require('lodash');
var utils = require('./nodeUtilities.js');

function extractKanjiHeadwords(block) {
  return (block.match(/<keb>[\S\s]*?<\/keb>/g) || [])
      .map(function(s) { return s.replace(/<[^>]*>/g, ''); });
}

function extractReadingHeadwords(block) {
  // JMdict entry is guaranteed to have <r_ele>, which must have <reb>, but fake
  // entries don't.
  return (block.match(/<reb>[\S\s]*?<\/reb>/g) || [])
      .map(function(s) { return s.replace(/<[^>]*>/g, ''); });
}

function extractSenses(block) {
  // JMdict entry must have <sense>, but <sense> might have no <gloss>
  return block.match(/<sense>[\s\S]*?<\/sense>/g)
      .map(function(sense) {
        return (sense.match(/<gloss>.*?<\/gloss>/g) || [])
            .map(function(s) { return s.replace(/<.*?>/g, ''); })
            .join('；');
      });
}

function extractEntrySequence(block) {
  return +(block.match(/<ent_seq>([0-9]+)<\/ent_seq>/)[1]);
}

var entries = utils.read('data/JMdict_e').trim().split('</entry>');

var headwords = entries.map(function(entry, number) {
  entry = entry.replace(/\n/g, '');
  var readings = extractReadingHeadwords(entry),
      kanji = extractKanjiHeadwords(entry);
  var obj = {readings : readings, kanji : kanji};

  if (kanji.length + readings.length === 0) {
    console.error("Can't find anything in entry number", number, entry);
    return null;
  }

  obj.usuallyKana = entry.search('&uk;') >= 0;
  obj.headwords =
      kanji.concat(kanji.length === 0 || obj.usuallyKana ? readings : []);

  // Find senses: all entries in JMdict should have >= 1 senses
  obj.senses = extractSenses(entry);

  // Finally, append the number for easy cross-reference
  obj.source = {entrySeq : extractEntrySequence(entry), name : "JMdict"};

  return obj;
});

headwords = lo.compact(headwords);  // Only needed for the last empty entry

// Add timestamp
headwords = utils.withDate(headwords);

// Write everything
utils.writeLineDelimitedJSON('data-static/JMdict-all.ldjson', headwords);

// To RethinkDB!
var config = require('./config');
if (true) {
  console.log(
      "Run\n$ rethinkdb import -f data-static/JMdict-all.ldjson --table " +
      config.dbName + ".headwords --force");
} else {
  var r = require('rethinkdb');

  var connection = null;
  r.connect({host : config.dbHost, port : config.dbPort})
      .then(function(c) {
        connection = c;
        console.log("Connected.");
        console.log("Deleting all headwords.");
        return r.db(config.dbName)
            .table(config.headwordsTable)
            .delete()
            .run(connection);
      })
      .then(function() {
        console.log("Adding all headwords.");
        return r.db(config.dbName)
            .table(config.headwordsTable)
            .insert(utils.withDate(headwords))
            .run(connection);
      })
      .then(function() { return connection.close() })
      .catch(console.error.bind(console, 'Error thrown!'));
}
