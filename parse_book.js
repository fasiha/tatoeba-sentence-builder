"use strict";
var utils = require('./nodeUtilities.js');
var _ = require('lodash');

var coreTuples = utils.readJSON('ordered-words.json')
                     .map(function(s) { return {words : s}; });
utils.readJSON('core5k.json')
    .forEach(function(s, idx) {
      coreTuples[idx].source = {
        name : 'Tono',
        num : idx,
        details : s
      };
    });

// To RethinkDB: get all sentences from it, and add the sentences that aren't
// already there (only look at Japanese & English parts of the sentence). For
// those that are already in db, don't touch them.
var r = require('rethinkdb');
var config = require('./config');

var connection = null;
r.connect({host : config.dbHost, port : config.dbPort})
    .then(function(c) {
      connection = c;
      console.log("Deleting all corewords.");
      return r.db(config.dbName)
          .table(config.corewordsTable)
          .delete()
          .run(connection);
    })
    .then(function() {
      console.log("Adding corewords.");
      return r.db(config.dbName)
          .table(config.corewordsTable)
          .insert(utils.withDate(coreTuples))
          .run(connection);
    })
    .then(function() {
      console.log("All done, closing connection.");
      return connection.close()
    })
    .catch(console.error.bind(console, 'Error thrown!'));

