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

    .then(function() { return connection.close() })

    .then(function() {
      console.log("All down for now!");
      return 1;
    })

    .catch(console.error.bind(console, 'Error thrown!'));

