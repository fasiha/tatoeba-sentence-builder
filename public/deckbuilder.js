"use strict";
var jsonPromisified = Promise.promisify(d3.json);

var GLOB;

jsonPromisified('v2/corewords')
    .then(function(corewords) {
      var corewordList = d3.select('#core-words').append('ol')
                             .selectAll('li.core-word')
                             .data(corewords)
                             .enter()
                             .append('li')
                             .classed('core-word', true)
                             .text(corewordObj => corewordObj.words.join('；'));

      var coreClicks =
          Kefir.fromEvents(d3.select('#core-words').node(), 'click');
      coreClicks.onValue(function(coreEvent) {
        d3.select('#dictionary').text('Looking up…');
        var core = d3.select(coreEvent.target).datum();

        jsonPromisified('/v2/headwords/' + core.words.join(','))
            .then(function(entries) {
              d3.select('#dictionary').text('');
              d3.select('#sentences').text('');

              if (entries.length === 0) {
                d3.select('#dictionary')
                    .text('No entries found for: ' + core.words.join('・'));
                return entries;
              }

              var headwordList =
                  d3.select('#dictionary')
                      .append('ol')
                      .selectAll('li.dict-entry')
                      .data(entries)
                      .enter()
                      .append('li')
                      .classed('dict-entry', true)
                      .text(entry => entry.headwords.concat(entry.readings)
                                         .join('・'));
              var senses =
                  headwordList.append('ol')
                      .selectAll('li.sense-entry')
                      .data(entry => entry.senses.map((sense, i) =>
                                                      {
                                                        return {
                                                          sense : sense,
                                                          entry : entry,
                                                          senseNum : i
                                                        };
                                                      }))
                      .enter()
                      .append('li')
                      .classed('sense-entry', true)
                      .text(senseObj => senseObj.sense);

              var entrySenseClicks =
                  Kefir.fromEvents(d3.select('#dictionary').node(), 'click');

              entrySenseClicks.onValue(function(entryEvent) {
                var entrySense = d3.select(entryEvent.target).datum();
                d3.select('#sentences').text('Looking up…');

                // Did we click on a top-level entry or a sense?
                var senseNum = 0, headword;
                
                if ('entry' in entrySense && 'sense' in entrySense) {
                  // Clicked a sense: show results for that sense, plus
                  // best-quality sentences without a sense
                  senseNum = entrySense.senseNum + 1;
                  headword = entrySense.entry.headwords[0];
                } else {
                  headword = entrySense.headwords[0];
                }

                jsonPromisified('/v2/sentences/' + headword + '/' + senseNum)
                    .then(function(sentences) {
                      d3.select('#sentences').text('');

                      if (sentences.length === 0) {
                        d3.select('#sentences')
                            .text('No sentences found for headword “' +
                                  headword + "”, sense #" + senseNum);
                        return sentences;
                      }
                      
                      var headwordList =
                          d3.select('#sentences')
                              .append('ol')
                              .selectAll('li.sentence')
                              .data(sentences)
                              .enter()
                              .append('li')
                              .classed('sentence', true)
                              .text(sentence => sentence.japanese + ' ' +
                                                sentence.english);
                      return sentences;
                    })
                    .catch(function(err) {
                      console.error("Error: sentences, ", err, err.stack)
                    });

              });

              return entries;
            })
            .catch(function(err) {
              console.error("Error: headwords, ", err, err.stack)
            });
      });
      return corewords;
    })
    .catch(function(err) {
      console.error("Error: corewords, ", err, err.stack)
    });
