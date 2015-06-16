"use strict";
var jsonPromisified = Promise.promisify(d3.json);

var GLOB;

var requestStream = Kefir.constant('v2/corewords');
var coreResponseStream =
    requestStream.flatMap(url => Kefir.fromPromise(jsonPromisified(url)));
coreResponseStream.onValue(function(corewords) {
  d3.select('#core-words')
      .append('ol')
      .selectAll('li.core-word')
      .data(corewords)
      .enter()
      .append('li')
      .classed('core-word', true)
      .text(corewordObj => corewordObj.words.join('；'));

});

var coreClickStream =
    Kefir.fromEvents(document.querySelector('#core-words'), 'click')
        .map(clickEvent => clickEvent.target.__data__);

var dictResponseStream =
    coreClickStream.flatMap(coreword => Kefir.fromPromise(jsonPromisified(
                                '/v2/headwords/' + coreword.words.join(','))));

dictResponseStream.merge(coreClickStream.map(() => null)).combine(coreClickStream)
    .onValue(function([ entries, coreword ]) {
  var words = coreword.words.join('・');
  var dictText;

  if (entries === null || entries.length === 0) {
    dictText = entries === null ? 'Looking up ' + words
                                : 'No dictionary entries found for ' + words;
    d3.select('#dictionary').text(dictText);
    d3.select('#sentences').text('');
  } else {
    var headwordList =
        d3.select('#dictionary')
            .append('ol')
            .selectAll('li.dict-entry')
            .data(entries)
            .enter()
            .append('li')
            .classed('dict-entry', true)
            .text(entry => entry.headwords.concat(entry.readings).join('・'));
    headwordList.append('ol')
        .selectAll('li.sense-entry')
        .data(entry => entry.senses.map(
                  (sense, i) =>
                  { return {sense : sense, entry : entry, senseNum : i}; }))
        .enter()
        .append('li')
        .classed('sense-entry', true)
        .text(senseObj => senseObj.sense);
  }
});

var entryClickStream =
    Kefir.fromEvents(document.querySelector('#dictionary'), 'click')
        .map(clickEvent =>
             {
               var entryOrSense = clickEvent.target.__data__;
               if (!entryOrSense) { // No data!
                 return null;
               }

               var senseNum = 0, headword;
               if ('entry' in entryOrSense && 'sense' in entryOrSense) {
                 // Clicked a sense
                 senseNum = entryOrSense.senseNum + 1;
                 headword = entryOrSense.entry.headwords[0];
               } else {
                 headword = entryOrSense.headwords[0];
               }
               return {headword, senseNum};
             })
        .filter();

var sentenceResponseStream = entryClickStream.flatMap(
    ({headword, senseNum}) => Kefir.fromPromise(
        jsonPromisified('/v2/sentences/' + headword + '/' + senseNum)));

sentenceResponseStream.merge(entryClickStream.map(() => null))
    .combine(entryClickStream)
    .onValue(function([sentences, {headword, senseNum}]) {
  if (typeof headword === 'undefined') {
    return;
  }
  if (sentences === null) {
    // clear sentence box
    d3.select('#sentences').text('');
  } else if (sentences.length === 0) {
    d3.select('#sentences')
        .text('No sentences found for headword “' + headword + "”, sense #" +
              senseNum);
  } else {
    d3.select('#sentences')
        .append('ol')
        .selectAll('li.sentence')
        .data(sentences)
        .enter()
        .append('li')
        .classed('sentence', true)
        .text(sentence => sentence.japanese + ' ' + sentence.english);
  }
});

