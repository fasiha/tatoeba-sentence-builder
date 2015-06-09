"use strict";
var utils = require('./nodeUtilities.js');
var _ = require('lodash');

var coreTuples = utils.readJSON('ordered-words.json')
                     .map(function(s) { return {words : s}; });
var book =
    utils.readJSON('core5k.json')
        .map(function(s, idx) {
          return {source : 'Tono', sourceDetails : s, sourceNum : idx + 1};
        });

var combined =
    _.zip(book, coreTuples).map(function(z) { return _.merge(z[0], z[1]); });

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
          .insert(combined)
          .run(connection);
    })
    .then(function() {
      console.log("All done, closing connection.");
      return connection.close()
    })
    .catch(console.error.bind(console, 'Error thrown!'));

