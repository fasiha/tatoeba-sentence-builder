'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

// Debug variable that shouldn't contain anything
var GLOB;

//////////////////////////////////////////
// SENTENCE-RELATED UTILITIES
//////////////////////////////////////////
function tonoDetailsCleanup(details) {
  var lines = details.split('\n');
  return lines[0].replace(/^[0-9]+ /, '') + '<br>' + (lines[1] || '');
}
var hanRegexp = XRegExp('\\p{Han}');
var hasKanji = function hasKanji(s) {
  return s.search(hanRegexp) >= 0;
};

//////////////////////////////////////////
// We use JSON GETs and POSTs exclusively. Use d3 for GET and fetch for POST.
//////////////////////////////////////////
var makePromisified = function makePromisified(method) {
  return function (url, obj) {
    return fetch(url, {
      method: method.toUpperCase(),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: _.isString(obj) ? obj : JSON.stringify(obj)
    }).then(function (res) {
      return res.json();
    })['catch'](function (ex) {
      return console.log('parsing failed', ex);
    });
  };
};
var jsonPromisified = makePromisified('get');
var postPromisified = makePromisified('post');
var putPromisified = makePromisified('put');
var deletePromisified = makePromisified('delete');
var jsonPromisifiedUncached = function jsonPromisifiedUncached(url, obj) {
  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: _.isString(obj) ? obj : JSON.stringify(obj)
  }).then(function (res) {
    return res.json();
  })['catch'](function (ex) {
    return console.log('parsing failed', ex);
  });
};

//////////////////////////////////////////
// First things first: login?
//////////////////////////////////////////
jsonPromisified('/loginstatus').then(function (res) {
  if (!res) {
    window.location.assign('/');
  }
});

//////////////////////////////////////////
// Pane 1: CORE WORDS
//////////////////////////////////////////
var coreStartStream = Kefir.constant(1);
var moreCoreClickStream = Kefir.fromEvents(document.querySelector('#more-core'), 'click');
var coreResponseStream = coreStartStream.merge(moreCoreClickStream.scan(function (prev, next) {
  return prev + 1;
}, 1)).flatMap(function (corePage) {
  return Kefir.fromPromise(jsonPromisified('/v2/corewords/?page=' + corePage));
});

coreResponseStream.onValue(function (corewords) {
  var c = d3.select('#core-words-list').selectAll('div.core-word').data(corewords, function (obj) {
    return obj.source.details;
  }) // FIXME won't work for non-Tono
  .enter().append('div').classed('core-word', true).html(function (corewordObj) {
    return '' + corewordObj.words.join('；') + ('<br>\n                        ' + tonoDetailsCleanup(corewordObj.source.details));
  });
  // c.append('button').classed('select-core', true).text('→');
  d3.select('#more-core').classed('no-display', false);
});

var coreClickStream = Kefir.fromEvents(document.querySelector('#core-words-list'), 'click').filter(function (ev) {
  return ev.target.tagName.toLowerCase() === 'div' && ev.target.className.indexOf('core-word') >= 0;
}).map(function (clickEvent) {
  d3.selectAll('div.clicked.core-word').classed('clicked', false);
  clickEvent.target.className += ' clicked';
  return clickEvent.target.__data__;
});

//////////////////////////////////////////
// Pane 2: DICTIONARY ENTRIES CORRESPONDING TO Pane 1 (CORE WORD) CLICKS
//////////////////////////////////////////
var dictResponseStream = coreClickStream.flatMap(function (coreword) {
  return Kefir.fromPromise(jsonPromisified('/v2/headwords/' + coreword.words.join(',')));
});

Kefir.combine([dictResponseStream.merge(coreClickStream.map(function () {
  return null;
}))], [coreClickStream]).onValue(function (_ref) {
  var _ref2 = _slicedToArray(_ref, 2);

  var entries = _ref2[0];
  var coreword = _ref2[1];

  var words = coreword.words.join('・');
  var dictText;

  if (entries === null || entries.length === 0) {
    dictText = entries === null ? '' : 'No dictionary entries found for ' + words;
    d3.select('#dictionary').text(dictText);
    clearSentences();
  } else {
    var headwordList = d3.select('#dictionary').append('ol').classed('headwords-list', true).selectAll('li.dict-entry').data(entries).enter().append('li').classed('dict-entry', true).text(function (entry) {
      return entry.headwords.join('・') + (entry.readings.length ? '・・' + entry.readings.join('・') : '');
    });
    headwordList.append('ol').attr('start', 0).classed('senses-list', true).selectAll('li.sense-entry').data(function (entry) {
      return ['(unspecified sense)'].concat(entry.senses).map(function (sense, i) {
        return { sense: sense, entry: entry, senseNum: i - 1 };
      });
    }).enter().append('li').classed('sense-entry', true).text(function (senseObj) {
      return senseObj.sense;
    });
  }
  if (coreword.source.num === -1) {
    d3.select('button#new-sentence').classed('no-display', false);
  }
});

var entryClickStream = Kefir.fromEvents(document.querySelector('#dictionary'), 'click').filter(function (ev) {
  return ev.target.tagName.toLowerCase() === 'li' && ev.target.className.indexOf('sense-entry') >= 0;
}).map(function (clickEvent) {
  var senseObj = clickEvent.target.__data__;
  if (!senseObj) {
    // No data!
    return null;
  }
  d3.selectAll('li.clicked.dict-entry').classed('clicked', false);
  d3.selectAll('li.clicked.sense-entry').classed('clicked', false);
  clickEvent.target.className += ' clicked';

  var senseNum = senseObj.senseNum + 1,
      headword = senseObj.entry.headwords[0];
  return { headword: headword, senseNum: senseNum, page: 1 };
}).filter();

//////////////////////////////////////////
// Pane 3: EXAMPLE SENTENCES BASED ON Pane 2 (DICTIONARY) CLICKS
//////////////////////////////////////////
function clearSentences() {
  d3.select('#sentences ol').selectAll('li').remove();
  d3.select('#more-sentences').classed('no-display', true);
  d3.select('button#new-sentence').classed('no-display', true);
}

// Pagination of Pane 3 (button requesting more sentences)
var moreSentencesClickStream = Kefir.fromEvents(document.querySelector('#more-sentences'), 'click');
var moreEntriesStream = entryClickStream.sampledBy(moreSentencesClickStream).map(function (obj) {
  obj.page++;
  return obj;
});

var sentenceResponseStream = entryClickStream.merge(moreEntriesStream).flatMap(function (_ref3) {
  var headword = _ref3.headword;
  var senseNum = _ref3.senseNum;
  var page = _ref3.page;
  return Kefir.fromPromise(jsonPromisified('/v2/sentences/' + headword + '/' + senseNum + '/?page=' + page));
});

Kefir.combine([sentenceResponseStream.merge(entryClickStream.map(function () {
  return null;
}))], [entryClickStream]).onValue(function (_ref4) {
  var _ref42 = _slicedToArray(_ref4, 2);

  var sentences = _ref42[0];
  var _ref42$1 = _ref42[1];
  var headword = _ref42$1.headword;
  var senseNum = _ref42$1.senseNum;

  if (sentences === null) {
    clearSentences();
  } else if (sentences.length === 0) {
    d3.select('#sentences ol').append('li').text('No sentences found for headword “' + headword + '”, sense #' + senseNum);
    d3.select('button#new-sentence').classed('no-display', false);
  } else {
    var sentences = d3.select('#sentences ol').selectAll('li.sentence').data(sentences, function (obj) {
      return obj.japanese;
    }).enter().append('li').classed('sentence', true).text(function (sentence) {
      return sentence.japanese + ' ' + sentence.english;
    });

    d3.select('#more-sentences').classed('no-display', false);
    d3.select('button#new-sentence').classed('no-display', false);

    sentences.append('button').classed('add-to-deck', true).text('✓');
  }
});

//////////////////////////////////////////
// Pane 4: DECK SENTENCES
//////////////////////////////////////////
var exampleSentenceAddClickStream = Kefir.fromEvents(document.querySelector('#sentences'), 'click').filter(function (ev) {
  return ev.target.tagName.toLowerCase() === 'button' && ev.target.className.indexOf('add-to-deck') >= 0;
}).map(function (ev) {
  return ev.target.__data__;
});

var exampleSentenceDeckSubmitStream = Kefir.combine([exampleSentenceAddClickStream], [entryClickStream, coreClickStream]).flatMap(function (_ref5) {
  var _ref52 = _slicedToArray(_ref5, 3);

  var sentenceObj = _ref52[0];
  var _ref52$1 = _ref52[1];
  var headword = _ref52$1.headword;
  var senseNum = _ref52$1.senseNum;
  var coreword = _ref52[2];

  // Server shouldn't send sentence document's ID but be careful. This
  // is a new sentence, NOT an edit.
  sentenceObj = _.omit(sentenceObj, 'id');
  // Add parameters here so the server doesn't have to.
  sentenceObj.ve = [];
  sentenceObj.group = {
    coreNum: coreword.source.num,
    num: -1, headword: headword, senseNum: senseNum
  };
  sentenceObj.globalNum = -1;
  sentenceObj.modifiedTime = new Date();

  return Kefir.fromPromise(postPromisified('/v2/deck', sentenceObj));
});

var deckClickStream = Kefir.fromEvents(document.querySelector('#deck'), 'click');

var deckButtonClickStream = deckClickStream.filter(function (ev) {
  return ev.target.tagName.toLowerCase() === 'button';
});

// New sentences
var deckNewSentenceClickStream = deckButtonClickStream.filter(function (ev) {
  return ev.target.id === 'new-sentence';
}).onValue(function (ev) {
  var editBox = d3.select('#deck').append('div').classed('new-sentence-box', true);
  var japanese = editBox.append('textarea').classed('edit-japanese', true).text('').attr('placeholder', '日本語');
  var english = editBox.append('textarea').classed('edit-english', true).text('').attr('placeholder', 'English');
  editBox.append('button').text('Submit').classed('done-newing', true);
  editBox.append('button').text('Cancel').classed('cancel-newing', true);
  return 1;
});

var deckDoneNewClickStream = deckButtonClickStream.filter(function (ev) {
  return ev.target.parentNode.className.indexOf('new-sentence-box') >= 0;
});
var deckNewResponseStream = Kefir.combine([deckDoneNewClickStream], [entryClickStream, coreClickStream]).flatMap(function (_ref6) {
  var _ref62 = _slicedToArray(_ref6, 3);

  var ev = _ref62[0];
  var _ref62$1 = _ref62[1];
  var headword = _ref62$1.headword;
  var senseNum = _ref62$1.senseNum;
  var coreword = _ref62[2];

  var div = d3.select(ev.target.parentNode);
  var button = ev.target.innerHTML;
  console.log(button);
  if (button === 'Submit') {
    var obj = {
      english: div.select('.edit-english').property('value'),
      japanese: div.select('.edit-japanese').property('value'),
      tags: [],
      ve: [],
      modifiedTime: new Date(),
      group: {
        coreNum: coreword.source.num,
        num: -1, headword: headword, senseNum: senseNum
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
var deckSentenceEditClickStream = deckButtonClickStream.filter(function (ev) {
  return ev.target.className.indexOf('edit-deck') >= 0;
}).map(function (ev) {
  return d3.select(ev.target.parentNode);
}); // FIXME FRAGILE!
deckSentenceEditClickStream.onValue(function (selection) {
  selection.select('button.edit-deck').classed('no-display', true);
  var deckObj = selection.datum();
  var editBox = selection.append('div').classed('edit-box', true);
  editBox.append('textarea').classed('edit-japanese', true).text(deckObj.japanese);
  editBox.append('textarea').classed('edit-english', true).text(deckObj.english);
  var furigana = editBox.append('ul').selectAll('li.furigana-list').data(deckObj.ve.filter(function (o) {
    return hasKanji(o.word);
  })).enter().append('li').classed('furigana-list', true).text(function (ve) {
    return ve.word + '：';
  });
  furigana.append('input').classed('edit-furigana', true).attr({ type: 'text' }).attr('value', function (ve) {
    return ve.reading;
  });
  editBox.append('button').text('Submit').classed('done-editing', true);
  editBox.append('button').text('Cancel').classed('done-editing', true);
  editBox.append('button').text('Delete').classed('done-editing', true);
  return selection;
});

var deckEdititedStream = deckButtonClickStream.filter(function (ev) {
  return ev.target.className.indexOf('done-editing') >= 0;
}).map(function (ev) {
  return d3.select(ev.target);
});
var deckEditResponseStream = deckEdititedStream.flatMap(function (selection) {
  var button = selection.text();
  var parentNode = selection.node().parentNode;
  var deckObj = parentNode.__data__;

  if (button === 'Submit') {
    var parentTag = d3.select(selection.node().parentNode); // FIXME SUPER-FRAGILE!
    deckObj.english = parentTag.select('textarea.edit-english').property('value');
    var newJapanese = parentTag.select('textarea.edit-japanese').property('value');
    deckObj.japanese = newJapanese === deckObj.japanese ? null : newJapanese;
    deckObj.modifiedTime = new Date();

    var furigana = parentTag.selectAll('input.edit-furigana')[0].map(function (node) {
      return node.value;
    });
    var kanjiLemmas = deckObj.ve.filter(function (veObj) {
      return hasKanji(veObj.word);
    });
    kanjiLemmas.forEach(function (ve, idx) {
      return ve.reading = furigana[idx];
    });
    return Kefir.fromPromise(putPromisified('/v2/deck/' + deckObj.id, deckObj));
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
var deckRequestStream = Kefir.merge([coreClickStream, coreClickStream.sampledBy(Kefir.merge([exampleSentenceDeckSubmitStream, deckEditResponseStream, deckNewResponseStream]))]);

var entryAndCoreClickStream = coreClickStream.map(function (coreObj) {
  return [null, coreObj];
}).merge(Kefir.combine([entryClickStream], [coreClickStream]));

var deckResponseStream = deckRequestStream.flatMap(function (corewordObj) {
  return Kefir.fromPromise(jsonPromisifiedUncached('/v2/deck/' + corewordObj.source.num));
});

// Deck render!
Kefir.combine([deckResponseStream, entryAndCoreClickStream]).onValue(function (_ref7) {
  var _ref72 = _slicedToArray(_ref7, 2);

  var deck = _ref72[0];

  var _ref72$1 = _slicedToArray(_ref72[1], 2);

  var entryObj = _ref72$1[0];
  var corewordObj = _ref72$1[1];

  if (entryObj) {
    var headword = entryObj.headword;
    var senseNum = entryObj.senseNum;

    // Sense-matching deck entries come first, then non-matching
    deck = _.flatten(_.partition(deck, function (o) {
      return o.group.senseNum === senseNum && o.group.headword === headword;
    }));
  }
  d3.select('#deck ol').html('');
  var sentences = d3.select('#deck ol').selectAll('li.deck-sentence').data(deck).enter().append('li').classed('deck-sentence', true).classed('off-sense', headword ? function (o) {
    return !(o.group.senseNum === senseNum && o.group.headword === headword);
  } : false).html(function (deckObj) {
    var furigana = veArrayToFuriganaMarkup(deckObj.ve);
    return furigana + ' ' + deckObj.english + '\n                              (s' + deckObj.group.senseNum + ') ';
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
    a: a.substring(preLen, a.length - postLen),
    b: b.substring(preLen, b.length - postLen),
    pre: a.substring(0, preLen),
    post: a.substring(a.length - postLen, a.length)
  };
}
function veArrayToFuriganaMarkup(ves) {
  return ves.map(function (v) {
    if (v.word.search(hanRegexp) < 0) {
      return v.word;
    }
    return wordReadingToRuby(v.word, kataToHira(v.reading));
  }).join('');
}

function wordReadingToRuby(word, reading) {
  var strip = findPrePostfix(word, reading);
  return strip.pre + (strip.a.length ? '<ruby>' + strip.a + '<rp>(</rp><rt>' + (strip.b.length ? strip.b : _.repeat('?', strip.a.length)) + '</rt><rp>)</rp></ruby>' : '') + strip.post;
}

var hiraString = 'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ';
var kataString = 'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ';

var kataToHiraTable = _.object(kataString.split(''), hiraString.split(''));
var kataToHira = function kataToHira(str) {
  return str.split('').map(function (c) {
    return kataToHiraTable[c] || c;
  }).join('');
};

