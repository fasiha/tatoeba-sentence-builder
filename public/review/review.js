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
/*
jsonPromisified('/loginstatus')
    .then(res => {
      if (!res) {
        window.location.assign('/');
      }
    });
*/

// Now, get the deck's contents
var deckResponseStream = Kefir.constant(1).flatMap(
    () => Kefir.fromPromise(jsonPromisifiedUncached('/v2/deck/?extra=true')));

// Bulk render! Just the function here.
var deckResponseStreamFunction =
    deck => {
      var groupByKeyVal = (...args) => _.values(_.mapValues(
          _.groupBy(...args), (val, key) => { return {key : key, val}; }));
      var deck2 =
          _.sortBy(groupByKeyVal(deck, o => o.group.coreNum), o => +o.key);

      // deck2 = deck2.filter(o => o.key !== "-1");

      deck2.forEach(kvCore => {
        kvCore.val =
            groupByKeyVal(kvCore.val, obj => obj.group.entrySeq ||
                                             obj.group.headwords.join(','));
        kvCore.val.forEach(kvHead => {
          kvHead.val =
              _.sortBy(groupByKeyVal(kvHead.val, obj => obj.group.senseNum),
                       o => +o.key);
        });
      });
      GLOB = deck2;
      
      d3.selectAll('.just-edited').classed('just-edited', false);

      var corewords = d3.select('#content').selectAll('div.coreword');
      corewords.data(deck2, d => `corenum-${d.key}`)
          .enter()
          .append('div')
          .classed('coreword', true)
          .append('h2')
          .text(
              coreKV =>
                  '#' +
                  (_.get(coreKV,
                         'val[0].val[0].val[0].corewordData.source.details') ||
                   '')
                      .split('\n')[0]);
      corewords = d3.select('#content').selectAll('div.coreword');


      var headwords =
          corewords.selectAll('div.headword');
      headwords.data(coreKV => coreKV.val, d => `headwords-${d.key}`)
          .enter()
          .append('div')
          .classed('headword', true)
          .append('h3')
          .text(headwordKV =>
                    headwordKV.val[0]
                        .val[0]
                        .dictionaryData.filter(o => o.source.entrySeq ===
                                                    +headwordKV.key)
                        .map(o => o.kanji.join('・') + '・' +
                                  o.readings.join('・'))[0] ||
                    headwordKV.key.split(',').join('・') + '?');
      headwords =
          corewords.selectAll('div.headword');

      var senses = headwords.selectAll('div.sense');
      senses.data(headwordKV => headwordKV.val, d => `sensenum-${d.key}`)
          .enter()
          .append('div')
          .classed('sense', true)
          .append('h4')
          .text(senseKV => senseKV.key);
      senses = headwords.selectAll('div.sense');

      var sentences =
          senses.selectAll('p.deck-sentence')
              .data(senseKV => senseKV.val, d => d.id);
      sentences = sentences.enter()
                      .append('p')
                      .classed('deck-sentence', true)
                      .classed('just-edited', deck.length > 1 ? false : true)
                      .attr('id', deckObj => 'id_' + deckObj.id)
                      .html(deckObj => {
                        var furigana =
                            furiganaUtils.veArrayToFuriganaMarkup(deckObj.ve);
                        return `${furigana} (${deckObj.english})`;
                      });
      sentences.append('button').classed('edit-deck', true).text('?');

      var objToNum = o => o.group.num ;
      d3.select('#content')
          .selectAll('div.coreword')
          .selectAll('div.headword')
          .selectAll('div.sense')
          .selectAll('p.deck-sentence')
          .sort((a, b) => objToNum(a) - objToNum(b));
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
  // GLOB = selection;
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
                     .data(deckObj.ve.filter(o => furiganaUtils.needsFurigana(o)))
                     .enter()
                     .append('li')
                     .classed('furigana-list', true)
                     .text(ve => ve.word + '：');
  furigana.append('input')
      .classed('edit-furigana', true)
      .attr({type : 'text'})
      .attr('value', ve => ve.reading);

  var dictionaryList = deckObjToHeadwordSenseList(deckObj);
  editBox.append('select')
      .selectAll('option')
      .data(dictionaryList)
      .enter()
      .append('option')
      .text(d => d)
  editBox.append('br');

  editBox.append('button').text('Submit').classed('done-editing', true);
  editBox.append('button').text('Cancel').classed('done-editing', true);
  // editBox.append('button').text('Delete').classed('done-editing',true);

  return selection;
});
function deckObjToHeadwordSenseList(deckObj) {
  return _.flatten(deckObj.dictionaryData.map(
      (o, oi) => o.senses.map(
          (s, i) =>
              `Entry ${oi+1}. ${o.kanji.join('・')}：${o.readings.join('・')} (sense ${i+1}) ${s}`)));
}
function deckObjToDictionaryData(deckObj, idx){
  var listOfOptions = _.flatten(
      deckObj.dictionaryData.map((o, i) => _.range(o.senses.length)
                                               .map(x => {
                                                 return {
                                                   headwords : o.headwords,
                                                   senseNum : x + 1,
                                                   entrySeq : o.source.entrySeq
                                                 }
                                               })));
  return listOfOptions[idx];
}
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
            var parentTag = d3.select(parentNode);  // FIXME SUPER-FRAGILE!

            var dictData = deckObjToDictionaryData(
                deckObj, parentTag.select('select').property('selectedIndex'));

            deckObj.group =
                _.merge(deckObj.group, dictData, (dest, src) => src);

            deckObj.english =
                parentTag.select('textarea.edit-english').property('value');
            var newJapanese =
                parentTag.select('textarea.edit-japanese').property('value');
            var japaneseChanged = newJapanese !== deckObj.japanese;
            deckObj.japanese = newJapanese;
            deckObj.modifiedTime = new Date();

            var furigana = parentTag.selectAll('input.edit-furigana')[0].map(
                node => node.value);
            var furiganaLemmas =
                deckObj.ve.filter(veObj => furiganaUtils.needsFurigana(veObj));
            furiganaLemmas.forEach((ve, idx) => ve.reading = furigana[idx]);
                        //console.log('writing id', deckObj.id, deckObj);

            return Kefir.fromPromise(Promise.all([
              putPromisified('/v2/deck/' + deckObj.id + '?japaneseChanged=' +
                                 japaneseChanged,
                             deckObj),
              deckObj
            ]));
          } else if (button === 'Cancel') {
            d3.select(parentNode.parentNode)
                .select('button.edit-deck')
                .classed('no-display', false);
            parentNode.remove();
            return 0;
          }
          /* else if (button === 'Delete') {
                                return
             Kefir.fromPromise(deletePromisified('/v2/deck/' +
                              deckObj.id));
                              }*/

          return 0;  // Never happens
        })
        .filter();
// Get the changes from the db, delete an element from DOM, and emit the object
var cleanResponseStream =
    editResponseStream.flatMap(response => {
                        if (!response || response.length !== 2) {
                          return 0;
                        }
                        var dbResponse = response[0];
                        var deckObj = response[1];

                        // Delete the data from the parent sense
                        var parentData = d3.select('#id_' + deckObj.id)
                                             .node()
                                             .parentNode.__data__;
                        parentData.val =
                            parentData.val.filter(o => o.id !== deckObj.id);

                        // And delete the object itself. We'll regenerate it
                        d3.selectAll('#id_' + deckObj.id).remove();
                        
                        return Kefir.constant([ deckObj ]);
                      })
        .filter().log();

// Here finally is the stream that reacts to both the JSON deck dump and the
// individual dumps due to edits.
deckResponseStream.merge(cleanResponseStream)
    .onValue(deckResponseStreamFunction);

