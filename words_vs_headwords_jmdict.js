"use strict";
var fs = require('fs');
var lo = require('lodash');
var util = require('./utilities.js');

var allHeadwords = JSON.parse(util.read('JMdict-headwords.json'));
var headwordsHash = lo.object(lo.flatten(lo.pluck(allHeadwords, 'headwords')));

var words = JSON.parse(util.read('ordered-words.json'));
var bools = words.map(function(tuple) {
  return lo.any(tuple.map(function(word) {
    return (word in headwordsHash) || (word.replace("ー", "") in headwordsHash);
  }));
});

var headless = lo.compact(words.map(function(list, num) {
  if (bools[num]) {
    return null;
  }
  return [list, num];
}));

var headed = words.filter(function(list, num) { return bools[num]; });

var tags = JSON.parse(fs.readFileSync('wwwjdic.tags', {encoding : 'utf8'}));
var goodTags = JSON.parse(fs.readFileSync('wwwjdic.good-tags', {encoding : 'utf8'}));

function wordlistsToNumSentences(arrOfWordlists, tagsObj) {
  return arrOfWordlists.map(function(list) {
    return lo.sum(list.map(function(head) {
      return (head in tagsObj) ? lo.flatten(lo.values(tagsObj[head])).length : 0;
    }));
  });
}

var headedWordsToSentences = wordlistsToNumSentences(headed, tags);
var headedWordsToGoodSentences = wordlistsToNumSentences(headed, goodTags);

