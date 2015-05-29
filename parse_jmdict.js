"use strict";
var lo = require('lodash');
var util = require('./utilities.js');

function extractKanjiHeadwords(block) {
  return block.match(/<keb>[\S\s]*?<\/keb>/g)
      .map(function(s) { return s.replace(/<[^>]*>/g, ''); });
}

function extractReadingHeadwords(block) {
  return block.match(/<reb>[\S\s]*?<\/reb>/g)
      .map(function(s) { return s.replace(/<[^>]*>/g, ''); });
}

function extractSenses(block) {
  return block.match(/<sense>[\s\S]*?<\/sense>/g).map(function(sense) {
    return sense.match(/<gloss>.*?<\/gloss>/g).map(function(s) {
      return s.replace(/<.*?>/g, '');
    }).join('；');
  });
}

var entries = util.read('data/JMdict_e').trim().split('</entry>');

var headwords = entries.map(function(entry, number) {
  entry = entry.replace(/\n/g, '');
  var obj;

  // Find headword
  if (entry.search('<k_ele>') >= 0) {
    obj = {headwords : extractKanjiHeadwords(entry), type : 'kanji'};
    if (entry.search('&uk;') >= 0) {
      var kanaHeads = extractReadingHeadwords(entry);
      obj.headwords = obj.headwords.concat(kanaHeads);
      obj.type = 'both';
    }
  } else if (entry.search('<r_ele>') >= 0) {
    obj = {headwords : extractReadingHeadwords(entry), type : 'reading'};
  } else {
    obj = null;
    console.error("Can't find anything in entry number", number, entry);
  }

  // For kanji-only headwords, which don't have any kana headwords, find
  // readings. Note that "usually-kana" entries will have readings as headwords,
  // so they aren't going to be here.
  obj.readings = [];
  if (obj.type === 'kanji') {
    obj.readings = extractReadingHeadwords(entry);
  }

  // Find senses: all entries in JMdict should have >= 1 senses
  var senses = obj ? extractSenses(entry) : null;
  if (senses && senses.length > 0 && obj) {
    obj.senses = senses;
  }

  // Finally, append the number for easy cross-reference
  if (obj) {
    obj.num = number;
  }

  return obj;
});

headwords = lo.compact(headwords);
// Everything
util.writeJSON('JMdict-all.json', headwords);
// Everything except senses
util.writeJSON('JMdict-headwords.json',
               headwords.map(function(obj) { return lo.omit(obj, 'senses'); }));
// Senses and numbers
util.writeJSON('JMdict-senses.json', headwords.map(function(obj) {
  return lo.omit(obj, 'headwords,type'.split(','));
}));

