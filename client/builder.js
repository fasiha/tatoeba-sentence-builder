"use strict";
var d3, _, XRegExp;

var jsonPromisified = Promise.promisify(d3.json);
/*
var xhrPromisified = Promise.promisify(d3.xhr);
var xhrText = function(url) {
  return xhrPromisified(url, 'text/plain')
      .then(function(res) { return res.responseText; });
};*/

var dataPath = '/min-';
var dataPaths = {
  words : dataPath + 'ordered-words.json',
  book : dataPath + 'core5k.json',
  headwords : dataPath + 'JMdict-headwords.json',
  senses : dataPath + 'JMdict-senses.json',
  tags : dataPath + 'wwwjdic-tags.json',
  goodTags : dataPath + 'wwwjdic-good-tags.json',
  sentences : dataPath + 'wwwjdic-sentences.json'
};

var dataGlobal;

// we do _.keys(...).map() so that we can later build the `data` object with
// _.keys(...). This is important since it's conceivable that _.map(...) and
// _.keys(...) iterate differently.
Promise.all(_.keys(dataPaths)
                .map(function(key) { return jsonPromisified(dataPaths[key]); }))
    .then(function(results) { return _.object(_.keys(dataPaths), results); })
    .then(function(data) {
  console.log('Now I have data!');
  dataGlobal = data;

  var headwordsHash = duplicateAwareObject(_.pluck(data.headwords, 'headwords'),
                                           _.pluck(data.headwords, 'num'));

  var coreSubset = data.words.slice(0, 50);
  var words = d3.select('#core-words')
      .selectAll('div.core-word')
      .data(coreSubset)
      .enter()
      .append('div')
      .classed('core-word', true)
      .text(function(d) { return d.join('；'); });

  var heads =
      words.selectAll('div.dict-entry')
          .data(d => d.filter(word => word in headwordsHash ||
                                      word.replace('ー', '') in headwordsHash))
          .enter()
          .append('div')
          .classed('dict-entry', true)
          .text(d => '・' + d);

}).catch (console.error.bind(console, 'Error in downloading data.'));

// Lodash & underscore have a function `invert` which takes an object's keys and
// values and swaps them. But this library function can't deal with values that
// are arrays. Sometimes we want `invert` to produce an output object whose keys
// are scalars inside those arrays (which were values in the input object).
function arrayAwareInvert(obj, multi) {
  if (typeof multi === 'undefined') {
    multi = false;
  }
  var res = {};
  for (var p in obj) {
    var arr = obj[p], len = arr.length;
    for (var i in arr) {
      if (!multi) {
        res[arr[i]] = p;
      } else {
        (res[arr[i]] || (res[arr[i]] = [])).push(p);
      }
    }
  }
  return res;
}

// The lodash/underscore function `object` can take two arrays, representing
// keys and values, and create an object from them. However, that library
// function handles duplicate keys by selecting only one corresponding value.
// Sometimes this is not what we desire: we want the returned object's values to
// be arrays, and values corresponding to duplicate keys result in values whose
// arrays are longer than one element.
function duplicateAwareObject(arrOfKeys, vals) {
  if (arrOfKeys.length !== vals.length) {
    throw "Keys and values arrays need to be same length";
  }
  var obj = {};
  arrOfKeys.forEach(function(keys, idx) {
    keys.forEach(function(key) { (obj[key] || (obj[key] = [])).push(vals[idx];) });
  });
  return obj;
}
