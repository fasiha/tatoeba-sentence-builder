"use strict";
var _ = require('lodash');
var utils = require('./nodeUtilities.js');
var debug = require('debug')('sentences');

module.exports = {};

// `tags` and `goodTags` are hash tables: their keys are headwords. But their
// values are also hash tables. The keys of an inner hash table are senses (null
// or an integer), and inner hash table values are arrays of integers. These
// integers, finally, are indexes into the `sentences` array of sentence
// objects.
//
// Because `tags` and `goodTags` are objects, not arrays, we pass `true` as a
// second argument to `readLineDelimitedJSON` to convert the line-delimited JSON
// array back into a hash table/object.
var tags = utils.readLineDelimitedJSON('data-static/wwwjdic-tags.ldjson', true);
var goodTags =
    utils.readLineDelimitedJSON('data-static/wwwjdic-good-tags.ldjson', true);

// This array contains objects with `english`, `japanese`, and `number` keys.
// The first two are sentences, and the last is an index number.
var sentences =
    utils.readLineDelimitedJSON('data-static/wwwjdic-sentences.ldjson');

function headwordSenseToSentences(headword, sense) {
  return tags[headword][sense].map(function(sentenceIdx) {
    return sentences[sentenceIdx];
  });
}

module.exports = {
  sentences : sentences,
  tags : tags,
  goodTags : goodTags,
  headwordSenseToSentences : headwordSenseToSentences
};
