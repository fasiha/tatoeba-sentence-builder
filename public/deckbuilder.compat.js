'use strict';

function _slicedToArray(arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }

var jsonPromisified = Promise.promisify(d3.json);

var GLOB;

var coreRequestStream = Kefir.constant('/v2/corewords');
var coreResponseStream = coreRequestStream.flatMap(function (url) {
  return Kefir.fromPromise(jsonPromisified(url));
});

coreResponseStream.onValue(function (corewords) {
  d3.select('#core-words').append('ol').selectAll('li.core-word').data(corewords).enter().append('li').classed('core-word', true).text(function (corewordObj) {
    return corewordObj.words.join('；') + (' (' + tonoDetailsCleanup(corewordObj.source.details) + ')');
  });
});

var deckRequestStream = Kefir.constant('/v2/deck');
var deckResponseStream = deckRequestStream.flatMap(function (url) {
  return Kefir.fromPromise(jsonPromisified(url));
});
deckResponseStream.onValue(function (deck) {
  d3.select('#deck').selectAll('p.deck-sentence').data(deck).enter().append('p').classed('deck-sentence', true).text(function (deckObj) {
    return '' + deckObj.japanese + ' ' + deckObj.english;
  });
});

var coreClickStream = Kefir.fromEvents(document.querySelector('#core-words'), 'click').map(function (clickEvent) {
  d3.selectAll('li.clicked.core-word').classed('clicked', false);
  clickEvent.target.className += ' clicked';
  return clickEvent.target.__data__;
});

var dictResponseStream = coreClickStream.flatMap(function (coreword) {
  return Kefir.fromPromise(jsonPromisified('/v2/headwords/' + coreword.words.join(',')));
});

dictResponseStream.merge(coreClickStream.map(function () {
  return null;
})).combine(coreClickStream).onValue(function (_ref) {
  var _ref2 = _slicedToArray(_ref, 2);

  var entries = _ref2[0];
  var coreword = _ref2[1];

  var words = coreword.words.join('・');
  var dictText;

  if (entries === null || entries.length === 0) {
    dictText = entries === null ? 'Looking up ' + words : 'No dictionary entries found for ' + words;
    d3.select('#dictionary').text(dictText);
    d3.select('#sentences').text('');
  } else {
    var headwordList = d3.select('#dictionary').append('ol').selectAll('li.dict-entry').data(entries).enter().append('li').classed('dict-entry', true).text(function (entry) {
      return entry.headwords.join('・') + (entry.readings.length ? '・・' + entry.readings.join('・') : '');
    });
    headwordList.append('ol').selectAll('li.sense-entry').data(function (entry) {
      return entry.senses.map(function (sense, i) {
        return { sense: sense, entry: entry, senseNum: i };
      });
    }).enter().append('li').classed('sense-entry', true).text(function (senseObj) {
      return senseObj.sense;
    });
  }
});

var entryClickStream = Kefir.fromEvents(document.querySelector('#dictionary'), 'click').map(function (clickEvent) {
  var entryOrSense = clickEvent.target.__data__;
  if (!entryOrSense) {
    // No data!
    return null;
  }
  d3.selectAll('li.clicked.dict-entry').classed('clicked', false);
  d3.selectAll('li.clicked.sense-entry').classed('clicked', false);
  clickEvent.target.className += ' clicked';

  var senseNum = 0,
      headword;
  if ('entry' in entryOrSense && 'sense' in entryOrSense) {
    // Clicked a sense
    senseNum = entryOrSense.senseNum + 1;
    headword = entryOrSense.entry.headwords[0];
  } else {
    headword = entryOrSense.headwords[0];
  }
  return { headword: headword, senseNum: senseNum };
}).filter();

var sentenceResponseStream = entryClickStream.flatMap(function (_ref3) {
  var headword = _ref3.headword;
  var senseNum = _ref3.senseNum;
  return Kefir.fromPromise(jsonPromisified('/v2/sentences/' + headword + '/' + senseNum));
});

sentenceResponseStream.merge(entryClickStream.map(function () {
  return null;
})).combine(entryClickStream).onValue(function (_ref4) {
  var _ref42 = _slicedToArray(_ref4, 2);

  var sentences = _ref42[0];
  var _ref42$1 = _ref42[1];
  var headword = _ref42$1.headword;
  var senseNum = _ref42$1.senseNum;

  if (sentences === null) {
    // clear sentence box
    d3.select('#sentences').text('');
  } else if (sentences.length === 0) {
    d3.select('#sentences').text('No sentences found for headword “' + headword + '”, sense #' + senseNum);
  } else {
    d3.select('#sentences').append('ol').selectAll('li.sentence').data(sentences).enter().append('li').classed('sentence', true).text(function (sentence) {
      return sentence.japanese + ' ' + sentence.english;
    });
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
    a: a.substring(preLen, a.length - postLen),
    b: b.substring(preLen, b.length - postLen),
    prefix: a.substring(0, preLen),
    postfix: a.substring(a.length - postLen, a.length)
  };
}

function tonoDetailsCleanup(details) {
  return details.split('\n')[0].replace(/^[0-9]+ /, '');
}

