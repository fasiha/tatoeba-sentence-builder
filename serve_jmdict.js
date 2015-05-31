"use strict";
var lo = require('lodash');
var util = require('./nodeUtilities.js');
var debug = require('debug')('serve_jmdict');

module.exports = {};

var obj = util.readJSON('JMdict-all.json');
var keyToHash = function(key) {
  return util.arrayAwareObject(lo.pluck(obj, key), lo.pluck(obj, 'num'), true);
};
var headwordsHash = keyToHash('headwords');
var readingsHash = keyToHash('readings');

var wordsToEntries = function(words, hash) {
  return lo.unique(lo.compact(lo.flatten(words.map(function(word) {
             return (hash[word] || [])
                 .concat(word.search('ー') < 0 ? []
                                               : hash[word.replace('ー', '')])
           }))))
      .map(function(n) { return obj[n] });
};

module.exports.lookupHeadword = function(words) {
  return wordsToEntries(words, headwordsHash)
};

module.exports.lookupReading = function(words) {
  return wordsToEntries(words, readingsHash)
};

module.exports.wordsToEntries = wordsToEntries;

module.exports.allEntries = obj;
module.exports.headwordsHash = headwordsHash;
module.exports.readingsHash = readingsHash;
