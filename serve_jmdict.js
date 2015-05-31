"use strict";
var lo = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var util = require('./nodeUtilities.js');

var debug = require('debug')('serve_jmdict');
module.exports = {};

fs.readFileAsync('JMdict-all.json', {encoding : 'utf8'})
    .then(JSON.parse)
    .then(function(obj) {
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

      module.exports.lookupHeadword = function(word) {
        return wordsToEntries(word, headwordsHash)
      };
      module.exports.lookupReading = function(word) {
        return wordsToEntries(word, readingsHash)
      };

      module.exports.wordsToEntries = wordsToEntries;

      module.exports.allEntries = obj;
      module.exports.headwordsHash = headwordsHash;
      module.exports.readingsHash = readingsHash;
    })

