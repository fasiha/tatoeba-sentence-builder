"use strict";
// Debug variable that shouldn't contain anything
var GLOB;

//////////////////////////////////////////
// SENTENCE-RELATED UTILITIES
//////////////////////////////////////////
function tonoDetailsCleanup(details) {
  var lines = details.split('\n');
  return lines[0].replace(/^[0-9]+ /, '') + '<br>' + (lines[1] || "");
}
var hanRegexp = XRegExp('\\p{Han}');
var hasKanji = s => s.search(hanRegexp) >= 0;
var nonKanaRegexp = XRegExp('[^\\p{Katakana}\\p{Hiragana}]');
// If there's a single non-kana character, it needs furigana.
var needsFurigana = s => s.search(nonKanaRegexp) >= 0;

//////////////////////////////////////////
// We use JSON GETs and POSTs exclusively. Use d3 for GET and fetch for POST.
//////////////////////////////////////////
var makePromisified = method =>
    ((url, obj) => fetch(url,
                         {
                           method : method.toUpperCase(),
                           headers : {
                             Accept : 'application/json',
                             'Content-Type' : 'application/json'
                           },
                           body : _.isString(obj) ? obj : JSON.stringify(obj)
                         })
                       .then(res => res.json())
                       .catch(ex => console.log('parsing failed', ex)));
var jsonPromisified = makePromisified('get');
var postPromisified = makePromisified('post');
var putPromisified = makePromisified('put');
var deletePromisified = makePromisified('delete');
var jsonPromisifiedUncached = (url, obj) =>
    fetch(url,
          {
            method : 'GET',
            headers : {
              Accept : 'application/json',
              'Content-Type' : 'application/json',
              'Cache-Control' : 'no-cache'
            },
            body : _.isString(obj) ? obj : JSON.stringify(obj)
          })
        .then(res => res.json())
        .catch(ex => console.log('parsing failed', ex));

//////////////////////////////////////////
// First things first: login?
//////////////////////////////////////////
jsonPromisified('/loginstatus')
    .then(res => {
      if (!res) {
        window.location.assign('/');
      }
    });

//////////////////////////////////////////
// Pane 1: CORE WORDS
//////////////////////////////////////////
var moreCoreClickStream =
    Kefir.fromEvents(document.querySelector('#more-core'), 'click');
var coreResponseStream =
    moreCoreClickStream.scan((prev, next) => prev + 1, 1)
        .flatMap(corePage => Kefir.fromPromise(
                     jsonPromisified(`/v2/corewords/?page=${corePage}`)));

var allCorewordsStream =
    coreResponseStream.scan((prev, next) => prev.concat(next));

Kefir.combine([ coreResponseStream ], [ allCorewordsStream ])
    .onValue(([ corewords, allCorewords ]) => {
      // FIXME this is horrible.
      var coreToIdx = _.object(allCorewords.map(o => o.source.details),
                          _.range(allCorewords.length));
      d3.select('#core-words-list')
          .selectAll('div.core-word')
          .data(corewords,
                obj => obj.source.details)  // FIXME won't work for non-Tono
          .enter()
          .append('div')
          .classed('core-word', true)
          .classed('repeated-core',
                   obj => _.any(
                       allCorewords.slice(0, 1 + coreToIdx[obj.source.details])
                           .map(o => o.words.join('') === obj.words.join('') &&
                                     o.source.details !== obj.source.details)))
          .html(corewordObj => `${corewordObj.words.join('；')}` + `<br>
                        ${tonoDetailsCleanup(corewordObj.source.details)}`);
      d3.select('#more-core').classed('no-display', false);
    });

var coreClickStream =
    Kefir.fromEvents(document.querySelector('#core-words-list'), 'click')
        .filter(ev => ev.target.tagName.toLowerCase() === 'div' &&
            ev.target.className.indexOf('core-word') >= 0)
        .map(clickEvent => {
          d3.selectAll('div.clicked.core-word').classed('clicked', false);
          clickEvent.target.className += ' clicked';
          return clickEvent.target.__data__;
        });

//////////////////////////////////////////
// Pane 2: DICTIONARY ENTRIES CORRESPONDING TO Pane 1 (CORE WORD) CLICKS
//////////////////////////////////////////
var dictResponseStream =
    coreClickStream.flatMap(coreword => Kefir.fromPromise(jsonPromisified(
                                '/v2/headwords/' + coreword.words.join(','))));

Kefir.combine([ dictResponseStream.merge(coreClickStream.map(() => null)) ],
              [ coreClickStream ])
    .onValue(function([ entries, coreword ]) {
      var words = coreword.words.join('・');
      var dictText;

      if (entries === null || entries.length === 0) {
        dictText = entries === null
                       ? ''
                       : 'No dictionary entries found for ' + words;
        d3.select('#dictionary').text(dictText);
        clearSentences();
      } else {
        var headwordList =
            d3.select('#dictionary')
                .append('ol')
                .classed('headwords-list', true)
                .selectAll('li.dict-entry')
                .data(entries)
                .enter()
                .append('li')
                .classed('dict-entry', true)
                .text(entry => entry.headwords.join('・') +
                               (entry.type === 'kanji'
                                    ? ('；' + entry.readings.join('・'))
                                    : ''));
        headwordList.append('ol')
            .attr('start', 0)
            .classed('senses-list', true)
            .selectAll('li.sense-entry')
            .data(entry => [
              '(unspecified sense)'
            ].concat(entry.senses)
                               .map((sense, i) => {
                                 return {sense, entry, senseNum : i - 1};
                               }))
            .enter()
            .append('li')
            .classed('sense-entry', true)
            .text(senseObj => senseObj.sense);
      }
      if (coreword.source.num === -1) {
        d3.select('button#new-sentence').classed('no-display', false);
      }
    });

var entryClickStream =
    Kefir.fromEvents(document.querySelector('#dictionary'), 'click')
        .filter(ev => ev.target.tagName.toLowerCase() === 'li' &&
                      ev.target.className.indexOf('sense-entry') >= 0)
        .map(clickEvent => {
          var senseObj = clickEvent.target.__data__;
          if (!senseObj) {  // No data!
            return null;
          }
          d3.selectAll('li.clicked.dict-entry').classed('clicked', false);
          d3.selectAll('li.clicked.sense-entry').classed('clicked', false);
          clickEvent.target.className += ' clicked';

          return {
            headword : senseObj.entry.headwords[0], // FIXME FIXME!
            senseNum : senseObj.senseNum + 1,
            entry : senseObj.entry,
            page : 1
          };
        })
        .filter();

//////////////////////////////////////////
// Pane 3: EXAMPLE SENTENCES BASED ON Pane 2 (DICTIONARY) CLICKS
//////////////////////////////////////////
function clearSentences() {
  d3.select('#sentences ol').selectAll('li').remove();
  d3.select('#more-sentences').classed('no-display', true);
  d3.select('button#new-sentence').classed('no-display',true);
}

// Pagination of Pane 3 (button requesting more sentences)
var moreSentencesClickStream =
    Kefir.fromEvents(document.querySelector('#more-sentences'), 'click');
var moreEntriesStream = entryClickStream.sampledBy(moreSentencesClickStream)
                            .map(obj => {
                              obj.page++;
                              return obj;
                            });

var sentenceResponseStream =
    entryClickStream.merge(moreEntriesStream)
        .flatMap(({headword, senseNum, page, entry}) => {
          var readingsQuery = entry.type === 'reading'
                                  ? ''
                                  : `&readings=${entry.readings.join(',')}`;
          return Kefir.fromPromise(jsonPromisified(
              `/v2/sentences/${headword}/${senseNum}/?page=${page}${readingsQuery}`));
        });

Kefir.combine([sentenceResponseStream.merge(entryClickStream.map(() => null))],
              [entryClickStream])
    .onValue(function([ sentences, {headword, senseNum} ]) {
  if (sentences === null) {
    clearSentences();
  } else if (sentences.length === 0) {
    d3.select('#sentences ol')
        .append('li')
        .text('No sentences found for headword “' + headword + "”, sense #" +
              senseNum);
    d3.select('button#new-sentence').classed('no-display',false);
  } else {
    var sentences =
        d3.select('#sentences ol')
            .selectAll('li.sentence')
            .data(sentences, obj => obj.japanese)
            .enter()
            .append('li')
            .classed('sentence', true)
            .text(sentence => sentence.japanese + ' ' + sentence.english);

    d3.select('#more-sentences').classed('no-display', false);
    d3.select('button#new-sentence').classed('no-display',false);

    sentences.append('button').classed('add-to-deck', true).text('✓');
    sentences.append('ul')
        .selectAll('li')
        .data(obj => obj.tags)
        .enter()
        .append('li')
        .text(tag => tag.headword + '/' + tag.reading);
  }
});

//////////////////////////////////////////
// Pane 4: DECK SENTENCES
//////////////////////////////////////////
var exampleSentenceAddClickStream =
    Kefir.fromEvents(document.querySelector('#sentences'), 'click')
        .filter(ev => ev.target.tagName.toLowerCase() === 'button' &&
                      ev.target.className.indexOf('add-to-deck') >= 0)
        .map(ev => ev.target.__data__);

var exampleSentenceDeckSubmitStream =
    Kefir.combine([exampleSentenceAddClickStream],
                  [ entryClickStream, coreClickStream ])
        .flatMap(([ sentenceObj, {headword, senseNum}, coreword ]) => {
          // Server shouldn't send sentence document's ID but be careful. This
          // is a new sentence, NOT an edit.
          sentenceObj = _.omit(sentenceObj, 'id');
          // Add parameters here so the server doesn't have to.
          sentenceObj.ve = [];
          sentenceObj.group = {
            coreNum : coreword.source.num,
            num : -1, headword, senseNum
          };
          sentenceObj.globalNum = -1;
          sentenceObj.modifiedTime = new Date();

          return Kefir.fromPromise(postPromisified('/v2/deck', sentenceObj));
        });

var deckClickStream =
    Kefir.fromEvents(document.querySelector('#deck'), 'click');

var deckButtonClickStream =
    deckClickStream.filter(ev => ev.target.tagName.toLowerCase() === 'button');

// New sentences
var deckNewSentenceClickStream =
    deckButtonClickStream.filter(ev => ev.target.id === 'new-sentence')
        .onValue((ev) =>
                 {
                   var editBox = d3.select('#deck').append('div').classed(
                       'new-sentence-box', true);
                   var japanese = editBox.append('textarea')
                                      .classed('edit-japanese', true)
                                      .text('')
                                      .attr('placeholder', '日本語');
                   var english = editBox.append('textarea')
                                     .classed('edit-english', true)
                                     .text('')
                                     .attr('placeholder', 'English');
                   editBox.append('button').text('Submit').classed(
                       'done-newing', true);
                   editBox.append('button').text('Cancel').classed(
                       'cancel-newing', true);
                   return 1;
                 });

var deckDoneNewClickStream = deckButtonClickStream.filter(
    ev => ev.target.parentNode.className.indexOf('new-sentence-box') >= 0);
var deckNewResponseStream =
    Kefir.combine([ deckDoneNewClickStream ],
                  [ entryClickStream, coreClickStream ])
        .flatMap(([ ev, {headword, senseNum}, coreword ]) => {
          var div = d3.select(ev.target.parentNode);
          var button = ev.target.innerHTML;
          console.log(button)
          if (button === 'Submit') {
            var obj = {
              english : div.select('.edit-english').property('value'),
              japanese : div.select('.edit-japanese').property('value'),
              tags : [],
              ve : [],
              modifiedTime : new Date(),
              group : {
                coreNum : coreword.source.num,
                num : -1, headword, senseNum
              }
            };
            return Kefir.fromPromise(postPromisified('/v2/deck', obj));
          } else if (button === 'Cancel') {
            div.remove();
            return 0;
          }
          return -1;
        });

// Edit existing sentence
var deckSentenceEditClickStream =
    deckButtonClickStream.filter(ev => ev.target.className.indexOf(
                                           'edit-deck') >= 0)
        .map(ev => d3.select(ev.target.parentNode));  // FIXME FRAGILE!
deckSentenceEditClickStream.onValue(selection => {
  selection.select('button.edit-deck').classed('no-display', true);
  var deckObj = selection.datum();
  var editBox = selection.append('div').classed('edit-box',true);
  editBox.append('textarea')
      .classed('edit-japanese', true)
      .text(deckObj.japanese);
  editBox.append('textarea')
      .classed('edit-english', true)
      .text(deckObj.english);
  var furigana = editBox.append('ul')
                     .selectAll('li.furigana-list')
                     .data(deckObj.ve.filter(o => needsFurigana(o.word)))
                     .enter()
                     .append('li')
                     .classed('furigana-list', true)
                     .text(ve => ve.word + '：');
  furigana.append('input')
      .classed('edit-furigana', true)
      .attr({type : 'text'})
      .attr('value', ve => ve.reading);
  editBox.append('button').text('Submit').classed('done-editing',true);
  editBox.append('button').text('Cancel').classed('done-editing',true);
  editBox.append('button').text('Delete').classed('done-editing',true);
  return selection;
});

var deckEdititedStream =
    deckButtonClickStream.filter(ev => ev.target.className.indexOf(
                                           'done-editing') >= 0)
        .map(ev => d3.select(ev.target));
var deckEditResponseStream = deckEdititedStream.flatMap(selection => {
  var button = selection.text();
  var parentNode = selection.node().parentNode;
  var deckObj = parentNode.__data__;

  if (button === 'Submit') {
    var parentTag =
        d3.select(selection.node().parentNode);  // FIXME SUPER-FRAGILE!
    deckObj.english =
        parentTag.select('textarea.edit-english').property('value');
    var newJapanese =
        parentTag.select('textarea.edit-japanese').property('value');
    var japaneseChanged = newJapanese !== deckObj.japanese;
    deckObj.japanese = newJapanese;
    deckObj.modifiedTime = new Date();

    var furigana =
        parentTag.selectAll('input.edit-furigana')[0].map(node => node.value);
    var furiganaLemmas = deckObj.ve.filter(veObj => needsFurigana(veObj.word));
    furiganaLemmas.forEach((ve, idx) => ve.reading = furigana[idx]);
    return Kefir.fromPromise(putPromisified(
        '/v2/deck/' + deckObj.id + '?japaneseChanged=' + japaneseChanged,
        deckObj));
  } else if (button === 'Cancel') {
    parentNode.remove();
    return 0;
  } else if (button === 'Delete') {
    return Kefir.fromPromise(deletePromisified('/v2/deck/' + deckObj.id));
  }
  return -1; // Never happens
});

// When you add an example sentence, create a new sentence, or edit an existing
// deck sentence, or just click on a new coreword, refresh the deck.
var deckRequestStream = Kefir.merge([
  coreClickStream,
  coreClickStream.sampledBy(Kefir.merge([
    exampleSentenceDeckSubmitStream,
    deckEditResponseStream,
    deckNewResponseStream
  ]))
]);

var entryAndCoreClickStream =
    coreClickStream.map(coreObj => [ null, coreObj ])
        .merge(Kefir.combine([ entryClickStream ], [ coreClickStream ]));

var deckResponseStream = deckRequestStream.flatMap(
    corewordObj => Kefir.fromPromise(
        jsonPromisifiedUncached('/v2/deck/' + corewordObj.source.num)));

// Deck render!
Kefir.combine([ deckResponseStream, entryAndCoreClickStream ])
    .onValue(([ deck, [ entryObj, corewordObj ] ]) => {
      if (entryObj) {
        var {headword, senseNum} = entryObj;
        // Sense-matching deck entries come first, then non-matching
        deck = _.flatten(_.partition(deck, o => o.group.senseNum === senseNum &&
                                                o.group.headword === headword));
      }
      d3.select('#deck ol').html('');
      var sentences = d3.select('#deck ol')
                          .selectAll('li.deck-sentence')
                          .data(deck)
                          .enter()
                          .append('li')
                          .classed('deck-sentence', true)
                          .classed('off-sense',
                                   headword
                                       ? o => !(o.group.senseNum === senseNum &&
                                                o.group.headword === headword)
                                       : false)
                          .html(deckObj => {
                            var furigana = veArrayToFuriganaMarkup(deckObj.ve);
                            return `${furigana} ${deckObj.english}
                              (s${deckObj.group.senseNum}) `
                          });
      sentences.append('button').classed('edit-deck', true).text('?');
    });

// FURIGANA UTILITIES
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
    pre : a.substring(0, preLen),
    post : a.substring(a.length - postLen, a.length)
  };
}
function veArrayToFuriganaMarkup(ves) {
  return ves.map(v => needsFurigana(v.word)
                          ? wordReadingToRuby(v.word, kataToHira(v.reading))
                          : v.word)
      .join('');
}

function wordReadingToRuby(word, reading) {
  var strip = findPrePostfix(word, reading);
  return strip.pre +
         (strip.a.length
              ? "<ruby>" + strip.a + "<rp>(</rp><rt>" +
                    (strip.b.length ? strip.b : _.repeat("?", strip.a.length)) +
                    "</rt><rp>)</rp></ruby>"
              : "") +
         strip.post;
}

const hiraString =
    "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
const kataString =
    "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";

var kataToHiraTable = _.object(kataString.split(''), hiraString.split(''));
var kataToHira = str =>
    str.split('').map(c => kataToHiraTable[c] || c).join('');

