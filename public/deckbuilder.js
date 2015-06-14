"use strict";
var jsonPromisified = Promise.promisify(d3.json);

jsonPromisified('v2/corewords')
    .then(function(corewords) {
      var corewordList = d3.select('#core-words')
                             .selectAll('p.core-word')
                             .data(corewords)
                             .enter()
                             .append('p')
                             .classed('core-word', true)
                             .text(corewordObj => corewordObj.words.join('；'));

      
    })
    .catch(function(err) {
      console.error("Error: corewords, ", err, err.stack)
    });
