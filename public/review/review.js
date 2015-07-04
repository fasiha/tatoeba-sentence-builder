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

// Now, get the deck's contents
var deckResponseStream = Kefir.constant(1).flatMap(
    () => Kefir.fromPromise(jsonPromisifiedUncached('/v2/deck/')));

// Bulk render! Just the function here.
var deckResponseStreamFunction =
    deck => {
      GLOB = deck;
      var groupByKeyVal = (...args) => _.values(_.mapValues(
          _.groupBy(...args), (val, key) => { return {key : +key, val}; }));
      var deck2 = _.sortBy(groupByKeyVal(GLOB, o => o.group.coreNum), 'key');
      deck2 = deck2.slice(1);
      deck2.forEach(
          kv => { kv.val = groupByKeyVal(kv.val, obj => obj.group.senseNum); });

      d3.selectAll('.just-edited').classed('just-edited', false);

      var corewords = d3.select('#content')
                          .selectAll('div.coreword')
                          .data(deck2)
                          .enter()
                          .append('div')
                          .classed('coreword', true);
      corewords.append('h2').text(coreKV => coreKV.key);

      var senses = corewords.selectAll('div.sense')
                       .data(coreKV => coreKV.val)
                       .enter()
                       .append('div')
                       .classed('sense', true);
      senses.append('h3').text(senseKV => senseKV.key);

      var sentences = senses.selectAll('p.deck-sentence')
                          .data(senseKV => senseKV.val)
                          .enter()
                          .append('p')
                          .classed('deck-sentence', true)
                          .html(deckObj => {
                            var furigana = veArrayToFuriganaMarkup(deckObj.ve);
                            return `${furigana} (${deckObj.english})`;
                          });
      sentences.append('button').classed('edit-deck', true).text('?');
/*
      var sentences =
          d3.select('#content ol')
              .selectAll('li.deck-sentence')
              .data(deck, deckObj => deckObj.id)
              .enter()
              .append('li')
              .classed('deck-sentence', true)
              .classed('just-edited', deck.length > 1 ? false : true)
              .attr('id', deckObj => 'id_' + deckObj.id)
              .html(deckObj => {
                var furigana = veArrayToFuriganaMarkup(deckObj.ve);
                return `${furigana} (${deckObj.english})`;
              });
      sentences.append('button').classed('edit-deck', true).text('?');

      var objToNum = o => o.group.coreNum + o.group.num / 1e3;
      d3.select('#content ol')
          .selectAll('li.deck-sentence')
          .sort((a, b) => objToNum(a) - objToNum(b));
          */
    }

// FRP the buttons
var clickStream = Kefir.fromEvents(document.querySelector('#content'), 'click');

var buttonClickStream =
    clickStream.filter(ev => ev.target.tagName.toLowerCase() === 'button');

// When someone clicks "?" button: edit mode!
var sentenceEditClickStream =
    buttonClickStream.filter(ev =>
                                 ev.target.className.indexOf('edit-deck') >= 0)
        .map(ev => d3.select(ev.target.parentNode));  // FIXME FRAGILE!
sentenceEditClickStream.onValue(selection => {
  selection.select('button.edit-deck').classed('no-display', true);
  var deckObj = selection.datum();
  var editBox = selection.append('div').classed('edit-box', true);
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
  editBox.append('button').text('Submit').classed('done-editing', true);
  editBox.append('button').text('Cancel').classed('done-editing', true);
  // editBox.append('button').text('Delete').classed('done-editing',true);
  return selection;
});

// When someone's done editing: capture the click,
var edititedStream = buttonClickStream.filter(ev => ev.target.className.indexOf(
                                                        'done-editing') >= 0)
                         .map(ev => d3.select(ev.target));
// Put the result into the db
var editResponseStream =
    edititedStream
        .flatMap(selection => {
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

            var furigana = parentTag.selectAll('input.edit-furigana')[0].map(
                node => node.value);
            var furiganaLemmas = deckObj.ve.filter(veObj => needsFurigana(veObj.word));
            furiganaLemmas.forEach((ve, idx) => ve.reading = furigana[idx]);
            return Kefir.fromPromise(
                putPromisified('/v2/deck/' + deckObj.id + '?japaneseChanged=' +
                                   japaneseChanged + '&returnChanges=true',
                               deckObj));
          } else if (button === 'Cancel') {
            parentNode.remove();
            return 0;
          }          /* else if (button === 'Delete') {
                      return Kefir.fromPromise(deletePromisified('/v2/deck/' +
                    deckObj.id));
                    }*/
          return 0;  // Never happens
        })
        .filter()
        .log();
// Get the changes from the db, delete an element from DOM, and emit the object
var cleanResponseStream =
    editResponseStream.flatMap(response => {
                        if (!response || !response.changes) {
                          return 0;
                        }

                        var id = response.changes[0].new_val.id;
                        d3.select('#id_' + id).remove();
                        var ret = [ response.changes[0].new_val ];
                        return Kefir.constant(ret);
                      })
        .filter();

// Here finally is the stream that reacts to both the JSON deck dump and the
// individual dumps due to edits.
deckResponseStream.merge(cleanResponseStream)
    .onValue(deckResponseStreamFunction);

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

