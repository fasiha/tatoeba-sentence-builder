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
/*
jsonPromisified('/loginstatus')
    .then(res => {
      if (!res) {
        window.location.assign('/');
      }
    });
*/
//////////////////////////////////////////
// Pane 1: CORE WORDS
//////////////////////////////////////////
var moreCoreClickStream = Kefir.fromEvents(document.querySelector('#more-core'), 'click');
var coreResponseStream = moreCoreClickStream.scan(function (prev, next) {
    return prev + 1;
}, 1).flatMap(function (corePage) {
    return Kefir.fromPromise(jsonPromisified('/v2/corewords/?page=' + corePage));
});

var allCorewordsStream = coreResponseStream.scan(function (prev, next) {
    return prev.concat(next);
});

Kefir.combine([coreResponseStream], [allCorewordsStream]).onValue(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var corewords = _ref2[0];
    var allCorewords = _ref2[1];

    // FIXME this is horrible.
    var coreToIdx = _.object(allCorewords.map(function (o) {
        return o.source.details;
    }), _.range(allCorewords.length));
    d3.select('#core-words-list').selectAll('div.core-word').data(corewords, function (obj) {
        return obj.source.details;
    }) // FIXME won't work for non-Tono
    .enter().append('div').classed('core-word', true).classed('repeated-core', function (obj) {
        return _.any(allCorewords.slice(0, 1 + coreToIdx[obj.source.details]).map(function (o) {
            return o.words.join('') === obj.words.join('') && o.source.details !== obj.source.details;
        }));
    }).html(function (corewordObj) {
        return '' + corewordObj.words.join('；') + ('<br>\n                        ' + tonoDetailsCleanup(corewordObj.source.details));
    });
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
}))], [coreClickStream]).onValue(function (_ref3) {
    var _ref32 = _slicedToArray(_ref3, 2);

    var entries = _ref32[0];
    var coreword = _ref32[1];

    var words = coreword.words.join('・');
    var dictText;

    if (entries === null || entries.length === 0) {
        dictText = entries === null ? '' : 'No dictionary entries found for ' + words;
        d3.select('#dictionary').text(dictText);
        clearSentences();
    } else {
        var headwordList = d3.select('#dictionary').append('ol').classed('headwords-list', true).selectAll('li.dict-entry').data(entries).enter().append('li').classed('dict-entry', true).text(function (entry) {
            return entry.kanji.concat(entry.readings).join('・');
        });
        headwordList.append('ol').attr('start', 0).classed('senses-list', true).selectAll('li.sense-entry').data(function (entry) {
            return ['(unspecified sense)'].concat(entry.senses).map(function (sense, i, senses) {
                return { sense: sense, entry: entry, senseNum: i - 1 };
            });
        }).enter().append('li').classed('sense-entry', true).text(function (senseObj) {
            return senseObj.sense.replace(/；/g, '； ');
        });
    }
    // If we're looking at pre-sentences, allow new "sentences" to be added
    // without a sense number
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

    return {
        entrySeq: senseObj.entry.source.entrySeq,
        headwords: senseObj.entry.headwords,
        senseNum: senseObj.senseNum + 1,
        entry: senseObj.entry,
        page: 1
    };
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

var sentenceResponseStream = entryClickStream.merge(moreEntriesStream).flatMap(function (_ref4) {
    var headwords = _ref4.headwords;
    var senseNum = _ref4.senseNum;
    var page = _ref4.page;
    var entry = _ref4.entry;

    var readingsQuery = entry.kanji.length === 0 ? '' : '&readings=' + entry.readings.join(',');
    return Kefir.fromPromise(jsonPromisified('/v2/sentences/' + headwords[0] + '/' + senseNum + '/?page=' + page + readingsQuery));
});

Kefir.combine([sentenceResponseStream.merge(entryClickStream.map(function () {
    return null;
}))], [entryClickStream]).onValue(function (_ref5) {
    var _ref52 = _slicedToArray(_ref5, 2);

    var sentences = _ref52[0];
    var _ref52$1 = _ref52[1];
    var headwords = _ref52$1.headwords;
    var senseNum = _ref52$1.senseNum;

    if (sentences === null) {
        clearSentences();
        return;
    }

    if (senseNum > 0) {
        d3.select('button#new-sentence').classed('no-display', false);
    }

    if (sentences.length === 0) {
        d3.select('#sentences ol').append('li').text('No sentences found for headword “' + headwords[0] + '”, sense #' + senseNum);
    } else {
        var sentences = d3.select('#sentences ol').selectAll('li.sentence').data(sentences, function (obj) {
            return obj.japanese;
        }).enter().append('li').classed('sentence', true).text(function (sentence) {
            return sentence.japanese + ' ' + sentence.english;
        });

        d3.select('#more-sentences').classed('no-display', false);

        sentences.append('button').classed('add-to-deck', true).text('✓');
        sentences.append('ul').selectAll('li').data(function (obj) {
            return obj.tags;
        }).enter().append('li').text(function (tag) {
            return tag.headword + '/' + tag.reading;
        });
    }
    return;
});

//////////////////////////////////////////
// Pane 4: DECK SENTENCES
//////////////////////////////////////////
var exampleSentenceAddClickStream = Kefir.fromEvents(document.querySelector('#sentences'), 'click').filter(function (ev) {
    return ev.target.tagName.toLowerCase() === 'button' && ev.target.className.indexOf('add-to-deck') >= 0;
}).map(function (ev) {
    return ev.target.__data__;
});

var exampleSentenceDeckSubmitStream = Kefir.combine([exampleSentenceAddClickStream], [entryClickStream, coreClickStream]).flatMap(function (_ref6) {
    var _ref62 = _slicedToArray(_ref6, 3);

    var sentenceObj = _ref62[0];
    var _ref62$1 = _ref62[1];
    var headwords = _ref62$1.headwords;
    var senseNum = _ref62$1.senseNum;
    var entrySeq = _ref62$1.entrySeq;
    var entry = _ref62$1.entry;
    var coreword = _ref62[2];

    // Server shouldn't send sentence document's ID but be careful.
    // This is a new sentence, NOT an edit.
    sentenceObj = _.omit(sentenceObj, 'id');
    // Add parameters here so the server doesn't have to.
    sentenceObj.ve = [];
    sentenceObj.group = {
        coreNum: coreword.source.num,
        num: -1, headwords: headwords,
        senseNum: senseNum === 0 && entry.senses.length === 1 ? 1 : senseNum,
        entrySeq: entrySeq
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
var deckNewResponseStream = Kefir.combine([deckDoneNewClickStream], [entryClickStream, coreClickStream]).flatMap(function (_ref7) {
    var _ref72 = _slicedToArray(_ref7, 3);

    var ev = _ref72[0];
    var _ref72$1 = _ref72[1];
    var headwords = _ref72$1.headwords;
    var senseNum = _ref72$1.senseNum;
    var entrySeq = _ref72$1.entrySeq;
    var coreword = _ref72[2];

    var div = d3.select(ev.target.parentNode);
    var button = ev.target.innerHTML;

    if (button === 'Submit') {
        var obj = {
            english: div.select('.edit-english').property('value'),
            japanese: div.select('.edit-japanese').property('value'),
            tags: [],
            ve: [],
            modifiedTime: new Date(),
            group: {
                coreNum: coreword.source.num,
                num: -1, headwords: headwords, senseNum: senseNum, entrySeq: entrySeq
            }
        };
        div.remove();
        d3.select('button#new-sentence').classed('no-display', false);
        return Kefir.fromPromise(postPromisified('/v2/deck', obj));
    } else if (button === 'Cancel') {
        div.remove();
        d3.select('button#new-sentence').classed('no-display', false);
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
        return furiganaUtils.needsFurigana(o);
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
        var japaneseChanged = newJapanese !== deckObj.japanese;
        deckObj.japanese = newJapanese;
        deckObj.modifiedTime = new Date();

        var furigana = parentTag.selectAll('input.edit-furigana')[0].map(function (node) {
            return node.value;
        });
        var furiganaLemmas = deckObj.ve.filter(function (veObj) {
            return furiganaUtils.needsFurigana(veObj);
        });
        furiganaLemmas.forEach(function (ve, idx) {
            return ve.reading = furigana[idx];
        });
        return Kefir.fromPromise(putPromisified('/v2/deck/' + deckObj.id + '?japaneseChanged=' + japaneseChanged, deckObj));
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
Kefir.combine([deckResponseStream, entryAndCoreClickStream]).onValue(function (_ref8) {
    var _ref82 = _slicedToArray(_ref8, 2);

    var deck = _ref82[0];

    var _ref82$1 = _slicedToArray(_ref82[1], 2);

    var entryObj = _ref82$1[0];
    var corewordObj = _ref82$1[1];

    if (entryObj) {
        var headwords = entryObj.headwords;
        var senseNum = entryObj.senseNum;
        var entrySeq = entryObj.entrySeq;

        // Sense-matching deck entries come first, then non-matching
        deck = _.flatten(_.partition(deck, function (o) {
            return o.group.senseNum === senseNum && o.group.entrySeq === entrySeq;
        }));
    }
    d3.select('#deck ol').html('');
    var sentences = d3.select('#deck ol').selectAll('li.deck-sentence').data(deck).enter().append('li').classed('deck-sentence', true).classed('off-sense', headwords ? function (o) {
        return !(o.group.senseNum === senseNum && o.group.entrySeq === entrySeq);
    } : false).html(function (deckObj) {
        var furigana = furiganaUtils.veArrayToFuriganaMarkup(deckObj.ve);
        return furigana + ' ' + deckObj.english + '\n                              (s' + deckObj.group.senseNum + ') ';
    });
    sentences.append('button').classed('edit-deck', true).text('?');
});

