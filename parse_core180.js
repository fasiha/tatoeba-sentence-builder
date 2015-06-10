"use strict";
var ve = require('./ve');
var _ = require('lodash');
var lo = require('lodash');

var Promise = require("bluebird");
var r = require('rethinkdb');
var config = require('./config');
var utils = require('./nodeUtilities.js');

// Basic object set
var basic = utils.read("data/Basic180.tsv")
                .trim()
                .split('\n')
                .map(function(s) {
                  return {japanese : s, english : "", tags : [], ve : []};
                });

// Ve. Sinatra even with thin apparently can't handle a couple of hundred
// sessions slamming it at the same time, so we have to put this ridiculous
// delay in. But if you may keep seeing Sinatra take longer and longer to
// service requests; restart it.
var connection = null;
Promise.all(basic.map(function(o, idx) {
         return Promise.delay(idx * 150 + Math.floor(idx / 50) * 100)
             .then(function() { return ve(o.japanese); })
             .then(function(veObj) {
               o.ve = veObj;
               console.log(idx, " done");
               return 1;
             });
       }))
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

