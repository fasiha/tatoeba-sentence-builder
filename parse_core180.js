"use strict";
var ve = require('./ve');
var _ = require('lodash');
var lo = require('lodash');

var Promise = require("bluebird");
var r = require('rethinkdb');
var config = require('./config');
var utils = require('./nodeUtilities.js');

// Basic object set
var basic =
    utils.read("data/BasicEng.tsv")
        .trim()
        .split('\n')
        .map(function(s, idx) {
          var tuple = s.split('\t');
          return {
            japanese : tuple[0],
            english : tuple[1],
            tags : [],
            ve : [],
            source : {name : "self"},
            globalNum : idx,
            group : {coreNum : -1, headword : "", senseNum : -1, num : idx}
          };
        });
// Examples have keys: english,japanese,source,tags,(modifiedTime,id).
// So deck sentences add: ve,num,globalNum,group

// Ve & RethinkDB.
var connection = null;
ve(_.pluck(basic, 'japanese'))
    .then(function(arrOfVeArrs) {
      arrOfVeArrs.forEach(function(veArr, idx) { basic[idx].ve = veArr; })
    })
    .then(function() {
      utils.writeLineDelimitedJSON("data-static/basic.ldjson", basic);

      // RethinkDB
      r.connect({host : config.dbHost, port : config.dbPort})
          .then(function(c) {
            connection = c;
            console.log("Adding basic with timestamps.");
            return r.db(config.dbName)
                .table(config.deckTable)
                .insert(utils.withDate(basic))
                .run(connection);
          })
          .then(function() {
            console.log("All done, closing connection.");
            return connection.close()
          })
          .catch(console.error.bind(console, 'Error thrown!'));
    });

