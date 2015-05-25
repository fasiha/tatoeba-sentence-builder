"use strict";
//var fs = require('fs');
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

  // Find # of senses
  var senses = entry.match(/<sense>/g);
  if (senses && senses.length > 0 && obj) {
    obj.numsenses = senses.length;
  }

  return obj;
});


if (headwords.length < 100) {
  console.log(headwords);
}
util.writeJSON('JMdict-headwords.json', lo.compact(headwords));

