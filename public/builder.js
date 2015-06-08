"use strict";
var d3, _, XRegExp;
var jsonPromisified = Promise.promisify(d3.json);

var dataPath = '/data-static/min-';
var dataPaths = {
  words : dataPath + 'ordered-words.json',
  book : dataPath + 'core5k.json',
  // headwords : dataPath + 'JMdict-headwords.json',
  // senses : dataPath + 'JMdict-senses.json',
  // tags : dataPath + 'wwwjdic-tags.json',
  // goodTags : dataPath + 'wwwjdic-good-tags.json',
  // sentences : dataPath + 'wwwjdic-sentences.json',
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
  
  var coreSubset = data.words.slice(0, 250);
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

  Promise.all(coreSubset.map(
                  tuple => jsonPromisified('/headwords/' + tuple.join(','))))
      .then(allResults => {
        var heads =
            words.append('ul')
                .classed('dict-entries-list', true)
                .selectAll('li.dict-entry')
                .data((tuple, tupleIdx) => allResults[tupleIdx])
                .enter()
                .append('li')
                .classed('dict-entry', true)
                .text(d => '' + d.headwords.concat(d.readings).join('・'));

        var noSenseExamplesPromises = [];
        heads.each(entry => noSenseExamplesPromises.push(jsonPromisified(
                       '/sentences/' + entry.headwords[0] + '/0')));

        Promise.all(noSenseExamplesPromises)
            .then(allNoSenseExamples => {
              // General examples (not tied to any sense)
              var parents =
                  heads.append('ul').append('li').text('General sentences');
              var noSenseExamples =
                  parents.append('ul')
                      .selectAll('li.example-nosense')
                      .data((_, allIdx) => allNoSenseExamples[allIdx])
                      .enter()
                      .append('li')
                      .classed('example-nosense', true)
                      .text(sentence =>
                                sentence.japanese + ' ' + sentence.english);

              // Dictionary senses
              var senses = heads.append('ol')
                               .classed('senses-list', true)
                               .selectAll('li.sense-entry')
                               .data(headword => headword.senses.map(
                                         (sense, i) =>
                                             {
                                               return {
                                                 sense : sense,
                                                 headword : headword,
                                                 senseNum : i
                                               }
                                             }))
                               .enter()
                               .append('li')
                               .classed('sense-entry', true)
                               .text(d => d.sense);

              // Examples illustrating specific senses
              var examplesPromises = [];
              senses.each(senseObj => examplesPromises.push(jsonPromisified(
                              '/sentences/' + senseObj.headword.headwords[0] +
                              '/' + (senseObj.senseNum + 1))));

              Promise.all(examplesPromises)
                  .then(allSensesExamples => {
                    var senseExamples =
                        senses.append('ul')
                            .selectAll('li.example-withsense')
                            .data((_, allIdx) => allSensesExamples[allIdx])
                            .enter()
                            .append('li')
                            .classed('example-withsense', true)
                            .text(sentence => sentence.japanese + ' ' +
                                              sentence.english);
                  });
            });
      });
}
