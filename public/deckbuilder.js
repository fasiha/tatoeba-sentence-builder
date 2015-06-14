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
      coreClicks.onValue(function(ev) {
        d3.select('#dictionary').text('Looking up…');
        var core = d3.select(ev.target).datum();
        jsonPromisified('/v2/headwords/' + core.words.join(','))
            .then(function(entries) {
              d3.select('#dictionary').text('');
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
              return entries;
            })
            .catch(function(err) {
              console.error("Error: headwords, ", err, err.stack)
            });
      });

    })
    .catch(function(err) {
      console.error("Error: corewords, ", err, err.stack)
    });
