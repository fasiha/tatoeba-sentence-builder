"use strict";
var d3, _, XRegExp;
var jsonPromisified = Promise.promisify(d3.json);

var dataPath = '/data-static/min-';
var dataPaths = {
  words : dataPath + 'ordered-words.json',
  book : dataPath + 'core5k.json',
  headwords : dataPath + 'JMdict-headwords.json',
  senses : dataPath + 'JMdict-senses.json',
  tags : dataPath + 'wwwjdic-tags.json',
  // goodTags : dataPath + 'wwwjdic-good-tags.json',
  sentences : dataPath + 'wwwjdic-sentences.json',
};

var dataGlobal;

// we do _.keys(...).map() so that we can later build the `data` object with
// _.keys(...). This is important since it's conceivable that _.map(...) and
// _.keys(...) iterate differently.
//
// We also build the data object in its own function (`return _.object(...)`)
// rather than combining the last two `then` functions, to conserve memory. If
// we created and used `data` in one function, `results` would be floating
// around, unless we overwrote it manually, which is ugly.
Promise.all(_.keys(dataPaths)
                .map(function(key) { return jsonPromisified(dataPaths[key]); }))
    .then(function(results) { return _.object(_.keys(dataPaths), results); })
    .then(renderData)
    .catch(console.error.bind(console, 'Error in downloading data.'));

function renderData(data) {
  console.log('Now I have data! And you can too: look in `dataGlobal`.');
  dataGlobal = data;

  var headwordsHash = arrayAwareObject(_.pluck(data.headwords, 'headwords'),
                                       _.pluck(data.headwords, 'num'), true);

  var coreSubset = data.words.slice(0, 50);
  var words =
      d3.select('#core-words')
          .append('ol')
          .selectAll('li.core-word')
          .data(coreSubset)
          .enter()
          .append('li')
          .classed('core-word', true)
          .text(function(d, i) {
            return d.join('；') + ' （' + data.book[i].split('\n')[0] + '）';
          });
  ;
  Promise.all(coreSubset.map(
                  tuple => jsonPromisified('/headwords/' + tuple.join(','))))
      .then(allResults => {
        var heads = words.append('ul')
                        .selectAll('li.dict-entry')
                        .data((d, i) => allResults[i])
                        .enter()
                        .append('li')
                        .classed('dict-entry', true)
                        .text(d => '' + d.headwords.join('・'));
 
        var senses = heads.append('ol')
                         .selectAll('li.sense-entry')
                         .data(d => d.senses.map(
                                   (sense, i) =>
                                       {
                                         return {
                                           sense : sense,
                                           headwordNum : d.num,
                                           senseNum : i
                                         }
                                       }))
                         .enter()
                         .append('li')
                         .classed('sense-entry', true)
                         .text(d => d.sense);

      });

  /*
  function headwordObjSenseToExamples(obj, sense) {
    return _.uniq(((data.tags[obj.headwords[0]] || [])[sense] || []))
        .slice(0, 3);
  }

  var examplesNoSenseParent = heads.append('ul');
  examplesNoSenseParent.append('li').text('No-sense examples:');
  var examplesNoSense =
      examplesNoSenseParent.append('ol')
          .selectAll('li.example-nosense')
          .data(headword => headwordObjSenseToExamples(headword, null))
          .enter()
          .append('li')
          .classed('example-nosense', true)
          .text(d => 'No-sense example: ' + data.sentences[d].japanese + ' ' +
                     data.sentences[d].english);

  var examplesWithSense =
      senses.append('ol')
          .selectAll('li.example-withsense')
          .data(sense => headwordObjSenseToExamples(
                    data.headwords[sense.headwordNum], sense.senseNum + 1))
          .enter()
          .append('li')
          .classed('example-withsense', true)
          .text(sentenceNum => 'Example: ' +
                               data.sentences[sentenceNum].japanese + ' ' +
                               data.sentences[sentenceNum].english);
                               */
}

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
    var arr = obj[p];
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

function arrayAwareObject(arrOfKeys, vals, multi) {
  if (arrOfKeys.length !== vals.length) {
    throw "Keys and values arrays need to be same length";
  }
  if (typeof multi === 'undefined') {
    multi = false;
  }
  var obj = {};
  arrOfKeys.forEach(function(keys, idx) {
    keys.forEach(function(key) {
      if (multi) {
        (obj[key] || (obj[key] = [])).push(vals[idx]);
      } else {
        obj[key] = vals[idx];
      }
    });
  });
  return obj;
}
