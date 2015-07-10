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

// Now, get the deck's contents
var deckResponseStream = Kefir.constant(1).flatMap(function () {
    return Kefir.fromPromise(jsonPromisifiedUncached('/v2/deck/?extra=true'));
});

// Bulk render! Just the function here.
var deckResponseStreamFunction = function deckResponseStreamFunction(deck) {
    GLOB = deck;
    d3.selectAll('.just-edited').classed('just-edited', false);

    /////////////////////////////////
    // Level 1: CORE WORDS
    /////////////////////////////////
    d3.select('#content').selectAll('div.coreword').data(_.sortBy(_.pairs(_.groupBy(deck, function (o) {
        return o.group.coreNum;
    })), function (v) {
        return +v[0];
    }), function (_ref) {
        var _ref2 = _slicedToArray(_ref, 1);

        var coreIdx = _ref2[0];
        return 'corenum-' + coreIdx;
    }).enter().append('div').classed('coreword', true).append('h2').text(function (_ref3) {
        var _ref32 = _slicedToArray(_ref3, 2);

        var coreIdx = _ref32[0];
        var sentences = _ref32[1];
        return '#' + (sentences[0].corewordData.source.details || '').split('\n')[0];
    });
    var corewords = d3.select('#content').selectAll('div.coreword');

    /////////////////////////////////
    // Level 2: dictionary entries/headwords
    /////////////////////////////////
    corewords.selectAll('div.headword').data(function (_ref4) {
        var _ref42 = _slicedToArray(_ref4, 2);

        var coreIdx = _ref42[0];
        var sentences = _ref42[1];
        return _.pairs(_.groupBy(sentences, function (o) {
            return o.group.entrySeq || o.group.headwords.join('・');
        }));
    }, function (_ref5) {
        var _ref52 = _slicedToArray(_ref5, 1);

        var entryKey = _ref52[0];
        return 'headwords-' + entryKey;
    }).enter().append('div').classed('headword', true).append('h3').text(function (_ref6) {
        var _ref62 = _slicedToArray(_ref6, 2);

        var entryKey = _ref62[0];
        var sentences = _ref62[1];
        return sentences[0].dictionaryData.filter(function (o) {
            return o.source.entrySeq === +entryKey;
        }).map(function (o) {
            return o.kanji.join('・') + '・' + o.readings.join('・');
        })[0] || entryKey.split(',').join('・') + '?';
    });
    var headwords = corewords.selectAll('div.headword');

    /////////////////////////////////
    // Level 3: senses (within a dictionary entry)
    /////////////////////////////////
    headwords.selectAll('div.sense').data(function (_ref7) {
        var _ref72 = _slicedToArray(_ref7, 2);

        var entryKey = _ref72[0];
        var sentences = _ref72[1];
        return _.pairs(_.groupBy(sentences, function (o) {
            return o.group.senseNum;
        }));
    }, function (_ref8) {
        var _ref82 = _slicedToArray(_ref8, 1);

        var senseNum = _ref82[0];
        return 'sensenum-' + senseNum;
    }).enter().append('div').classed('sense', true).append('h4').text(function (_ref9) {
        var _ref92 = _slicedToArray(_ref9, 2);

        var senseNum = _ref92[0];
        var sentences = _ref92[1];
        return sentences[0].group.entrySeq && +senseNum > 0 ? sentences[0].dictionaryData.filter(function (o) {
            return o.source.entrySeq === sentences[0].group.entrySeq;
        })[0].senses[+senseNum - 1] : senseNum;
    });
    var senses = headwords.selectAll('div.sense');

    /////////////////////////////////
    // Final level, level 4: sentences!
    /////////////////////////////////
    var sentences = senses.selectAll('p.deck-sentence').data(function (_ref10) {
        var _ref102 = _slicedToArray(_ref10, 2);

        var senseNum = _ref102[0];
        var sentences = _ref102[1];
        return sentences;
    }, function (o) {
        return o.id;
    });
    sentences = sentences.enter().append('p').classed('deck-sentence', true).classed('just-edited', deck.length > 1 ? false : true).attr('id', function (deckObj) {
        return 'id_' + deckObj.id;
    }).html(function (deckObj) {
        var furigana = furiganaUtils.veArrayToFuriganaMarkup(deckObj.ve);
        return furigana + ' ' + deckObj.english;
    });
    sentences.append('button').classed('edit-deck', true).text('?');

    // Reorganize sentences
    var objToNum = function objToNum(o) {
        return o.group.num;
    };
    d3.select('#content').selectAll('div.coreword').selectAll('div.headword').selectAll('div.sense').selectAll('p.deck-sentence').sort(function (a, b) {
        return objToNum(a) - objToNum(b);
    });
};

// FRP the buttons
var clickStream = Kefir.fromEvents(document.querySelector('#content'), 'click');

var buttonClickStream = clickStream.filter(function (ev) {
    return ev.target.tagName.toLowerCase() === 'button';
});

// When someone clicks "?" button: edit mode!
var sentenceEditClickStream = buttonClickStream.filter(function (ev) {
    return ev.target.className.indexOf('edit-deck') >= 0;
}).map(function (ev) {
    return d3.select(ev.target.parentNode);
}); // FIXME FRAGILE!

sentenceEditClickStream.onValue(function (selection) {
    // GLOB = selection;
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

    var dictionaryList = _.flatten((true ? deckObj.dictionaryData : _.sortBy(deckObj.dictionaryData, function (dict) {
        return -_.intersection(dict.headwords, deckObj.group.headwords).length;
    })).map(function (entryObj, entryIdx) {
        return entryObj.senses.map(function (sense, senseIdx) {
            return (deckObj.group.senseNum === 0 ? '' : senseIdx + 1 === deckObj.group.senseNum ? '' : '？') + ('Entry ' + (entryIdx + 1) + '. ' + entryObj.kanji.join('・') + '：') + ('' + entryObj.readings.join('・')) + (' (sense ' + (senseIdx + 1) + ') ' + sense);
        });
    }));
    var defaultIdx = _.findIndex(dictionaryList, function (s) {
        return s[0] !== '？';
    });
    editBox.append('select').selectAll('option').data(dictionaryList).enter().append('option').text(function (d) {
        return d;
    }).attr('selected', function (d, i) {
        return i === defaultIdx ? 'selected' : null;
    });
    editBox.append('br');

    editBox.append('button').text('Submit').classed('done-editing', true);
    editBox.append('button').text('Cancel').classed('done-editing', true);
    // editBox.append('button').text('Delete').classed('done-editing',true);

    return selection;
});

function deckObjToDictionaryData(deckObj, idx) {
    var listOfOptions = _.flatten(deckObj.dictionaryData.map(function (o, i) {
        return _.range(o.senses.length).map(function (x) {
            return {
                headwords: o.headwords,
                senseNum: x + 1,
                entrySeq: o.source.entrySeq
            };
        });
    }));
    return listOfOptions[idx];
}
// When someone's done editing: capture the click,
var edititedStream = buttonClickStream.filter(function (ev) {
    return ev.target.className.indexOf('done-editing') >= 0;
}).map(function (ev) {
    return d3.select(ev.target);
});
// Put the result into the db
var editResponseStream = edititedStream.flatMap(function (selection) {
    var button = selection.text();
    var parentNode = selection.node().parentNode;
    var deckObj = parentNode.__data__;

    if (button === 'Submit') {
        var parentTag = d3.select(parentNode); // FIXME SUPER-FRAGILE!

        var dictData = deckObjToDictionaryData(deckObj, parentTag.select('select').property('selectedIndex'));

        deckObj.group = _.merge(deckObj.group, dictData, function (dest, src) {
            return src;
        });

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
        //console.log('writing id', deckObj.id, deckObj);

        return Kefir.fromPromise(Promise.all([putPromisified('/v2/deck/' + deckObj.id + '?japaneseChanged=' + japaneseChanged + '&returnChanges=true', deckObj), deckObj]));
    } else if (button === 'Cancel') {
        d3.select(parentNode.parentNode).select('button.edit-deck').classed('no-display', false);
        parentNode.remove();
        return 0;
    }
    /* else if (button === 'Delete') {
                          return
       Kefir.fromPromise(deletePromisified('/v2/deck/' +
                        deckObj.id));
                        }*/

    return 0; // Never happens
}).filter();
// Get the changes from the db, delete an element from DOM, and emit the object
var cleanResponseStream = editResponseStream.flatMap(function (response) {
    if (!response || response.length !== 2) {
        return 0;
    }
    var dbResponse = response[0];
    var deckObj = response[1];

    var newVe = _.get(dbResponse, 'changes[0].new_val.ve');
    if (newVe) {
        deckObj.ve = newVe;
    }

    // Delete the data from the parent sense and
    // grand-parent entry, otherwise it'll get regenerated
    // too many times >.<
    var parentNode = d3.select('#id_' + deckObj.id).node().parentNode;
    parentNode.__data__ = [parentNode.__data__[0], parentNode.__data__[1].filter(function (o) {
        return o.id !== deckObj.id;
    })];

    parentNode = parentNode.parentNode;
    parentNode.__data__ = [parentNode.__data__[0], parentNode.__data__[1].filter(function (o) {
        return o.id !== deckObj.id;
    })];

    // And delete the object itself. We'll regenerate it
    d3.selectAll('#id_' + deckObj.id).remove();

    return Kefir.constant([deckObj]);
}).filter();

// Here finally is the stream that reacts to both the JSON deck dump and the
// individual dumps due to edits.
deckResponseStream.merge(cleanResponseStream).onValue(deckResponseStreamFunction);

