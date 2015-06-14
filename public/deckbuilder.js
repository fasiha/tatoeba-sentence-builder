"use strict";
var jsonPromisified = Promise.promisify(d3.json);

var GLOB;

jsonPromisified('v2/corewords')
    .then(function(corewords) {
      var corewordList = d3.select('#core-words')
                             .selectAll('p.core-word')
                             .data(corewords)
                             .enter()
                             .append('p')
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
              d3.select('#dictionary')
                  .selectAll('p.dict-entry')
                  .data(entries)
                  .enter()
                  .append('p')
                  .classed('dict-entry', true)
                  .text(entry =>
                            entry.headwords.concat(entry.readings).join('・'));
              return entries;
            });
      });

    })
    .catch(function(err) {
      console.error("Error: corewords, ", err, err.stack)
    });
