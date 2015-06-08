"use strict";
var r = require('rethinkdb');
var Promise = require("bluebird");
var config = require('./config');

var connection = null;

r.connect({host : config.dbHost, port : config.dbPort})

    .then(function(c) {
      console.log("Connected.");
      connection = c;
      return r.dbList().run(connection);
    })

    .then(function(dbs) {
      if (dbs.indexOf(config.dbName) < 0) {
        console.log("Creating database.");
        return r.dbCreate(config.dbName).run(connection);
      }
      console.log("Database exists, skipping creation.");
      return 1;  // return object doesn't matter
    })

    .then(function() {
      return r.db(config.dbName).tableList().run(connection);
    })

    .then(function(tables) {
      return Promise.all([
        config.corewordsTable,
        config.headwordsTable,
        config.examplesTable,
        config.deckTable
      ].map(function(name) {
        if (tables.indexOf(name) < 0) {
          console.log("Creating " + name + ' table.');
          return r.db(config.dbName)
              .tableCreate(
                  name, {primaryKey : config.tablesToPrimaryKey[name] || "id"})
              .run(connection);
        }
        console.log("Table " + name + " already exists.");
        return 1;
      }));
    })

    .then(function() {
      console.log("Creating `headwords` secondary index for sentences.");
      return r.db(config.dbName)
          .table(config.examplesTable)
          .indexCreate("headwords", r.row("tags")("headword"), {multi : true})
          .run(connection);
    })

    .then(function() {
      console.log("Creating `headwordsSense` compound secondary index.");
      // The arbitrary function being used by indexCreate is building, for each
      // document, an array of 2-tuples. The length of this array is equal to
      // the number of tags (i.e., `obj.tags.length`). And its contents are
      // ["headword", senseNumber]. In plain JS, this is equivalent to
      // sentences.map(function(obj){return _.zip(_.pluck(obj.tags,"headword"),
      // _.pluck(obj.tags, "sense"))}).
      return r.db(config.dbName)
          .table(config.examplesTable)
          .indexCreate("headwordsSense",
                       function(obj) {
                         return obj("tags").map(function(tag) {
                           return [ tag("headword"), tag("sense") ];
                         });
                       },
                       {multi : true})
          .run(connection);
    })

    .then(function() {
      console.log("All done, closing connection.");
      return connection.close()
    })

    .catch(console.error.bind(console, 'Error thrown!'));

