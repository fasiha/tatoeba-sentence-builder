"use strict";
var jsonPromisified = Promise.promisify(d3.json);

var GLOB;

var coreRequestStream = Kefir.constant('/v2/corewords');
var coreResponseStream =
    coreRequestStream.flatMap(url => Kefir.fromPromise(jsonPromisified(url)));

coreResponseStream.onValue(function(corewords) {
  d3.select('#core-words')
      .append('ol')
      .selectAll('li.core-word')
      .data(corewords)
      .enter()
      .append('li')
      .classed('core-word', true)
      .text(corewordObj =>
                corewordObj.words.join('；') +
                ` (${tonoDetailsCleanup(corewordObj.source.details)})`);
});

var deckRequestStream = Kefir.constant('/v2/deck');
var deckResponseStream =
    deckRequestStream.flatMap(url => Kefir.fromPromise(jsonPromisified(url)));
deckResponseStream.onValue(function(deck) {
  d3.select('#deck')
      .selectAll('p.deck-sentence')
      .data(deck)
      .enter()
      .append('p')
      .classed('deck-sentence', true)
      .text(deckObj => `${deckObj.japanese} ${deckObj.english}`);
});

var coreClickStream =
    Kefir.fromEvents(document.querySelector('#core-words'), 'click')
        .map(clickEvent => {
          d3.selectAll('li.clicked.core-word').classed('clicked', false);
          clickEvent.target.className += ' clicked';
          return clickEvent.target.__data__;
        });

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
            .text(entry => entry.headwords.join('・') + (entry.readings.length
                               ? ('・・' + entry.readings.join('・'))
                               : ''));
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
               d3.selectAll('li.clicked.dict-entry').classed('clicked', false);
               d3.selectAll('li.clicked.sense-entry').classed('clicked', false);
               clickEvent.target.className += ' clicked';

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

function findPrePostfix(a, b) {
  var minLength = Math.min(a.length, b.length);

  // Important initialization and prefix search
  var preLen = minLength;
  for (var i = 0; i < minLength; i++) {
    if (a[i] !== b[i]) {
      preLen = i;
      break;
    }
  }

  // Similar search for postfix search plus an important initialization
  var postLen = minLength - preLen;
  for (var i = 0; i < minLength - preLen; i++) {
    if (a[a.length - i - 1] !== b[b.length - i - 1]) {
      postLen = i;
      break;
    }
  }

  return {
    a : a.substring(preLen, a.length - postLen),
    b : b.substring(preLen, b.length - postLen),
    prefix : a.substring(0, preLen),
    postfix : a.substring(a.length - postLen, a.length)
  };
}

function tonoDetailsCleanup(details) {
  return details.split('\n')[0].replace(/^[0-9]+ /, '');
}
