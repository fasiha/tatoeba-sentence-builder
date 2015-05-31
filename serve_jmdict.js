"use strict";
var _ = require('lodash');
var util = require('./nodeUtilities.js');
var debug = require('debug')('serve_jmdict');

module.exports = {};

var obj = util.readJSON('min-JMdict-all.json');
var keyToHash = function(key) {
  return util.arrayAwareObject(_.pluck(obj, key), _.pluck(obj, 'num'), true);
};
var headwordsHash = keyToHash('headwords');
var readingsHash = keyToHash('readings');

var wordsToEntries = function(words, hash) {
  return _.unique(_.compact(_.flatten(words.map(function(word) {
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
