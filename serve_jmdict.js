"use strict";
var _ = require('lodash');
var utils = require('./nodeUtilities.js');
var debug = require('debug')('serve_jmdict');

module.exports = {};

// Creates ~1 GB of ephemeral garbage :(
// var obj = utils.readJSON('min-JMdict-all.json');
// So split the string into pieces and parse the elements individually.
var obj = utils.read("JMdict-all.json")
              .trim()
              .slice(1, -1 - 2)
              .split('\n },')
              .map(function(s) { return JSON.parse(s + '}') });
var keyToHash = function(key) {
  return utils.arrayAwareObject(_.pluck(obj, key), _.pluck(obj, 'num'), true);
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

