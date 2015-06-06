"use strict";
var r = require('rethinkdb');
var _ = require('lodash');
var Promise = require("bluebird");

var DB_NAME = "unlocked";
// DB_NAME = "test";

var WORDS_TABLE = "corewords";
var DICT_TABLE = "headwords";
var EXAMPLES_TABLE = "examplesentences";
var SENTENCES_DECK_TABLE = "decksentences";

var connection = null;
r.connect({host : 'localhost', port : 28015})

    .then(function(c) {
      console.log("Connected.");
      connection = c;
      return r.dbList().run(connection);
    })

    .then(function(dbs) {
      if (dbs.indexOf(DB_NAME) < 0) {
        console.log("Creating database.");
        return r.dbCreate(DB_NAME).run(connection);
      }
      console.log("Database exists, skipping creation.");
      return 1;  // return object doesn't matter
    })

    .then(function() { return r.db(DB_NAME).tableList().run(connection); })

    .then(function(tables) {
      return Promise.all(
          [ WORDS_TABLE, DICT_TABLE, EXAMPLES_TABLE, SENTENCES_DECK_TABLE ].map(
              function(name) {
                if (tables.indexOf(name) < 0) {
                  console.log("Creating " + name + ' table.');
                  return r.db(DB_NAME).tableCreate(name).run(connection);
                }
                console.log("Table " + name + " already exists.");
                return 1;
              }));
    })

    .then(function() {
      console.log("All down for now!");
      return undefined;
    })

    .catch(console.error.bind(console, 'Error thrown!'));

// FIXME Doesn't seem to be reached, even though everything is done.
console.log('Quitting.');
