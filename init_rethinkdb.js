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
    // Creating tables
    .then(function(tables) {
      return Promise.all([
        config.corewordsTable,
        config.headwordsTable,
        config.examplesTable,
        config.deckTable,
        config.usersTable
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
    // Index for deckTable
    .then(function() {
      console.log("Getting indexes: deck table.");
      return r.db(config.dbName)
          .table(config.deckTable)
          .indexList()
          .run(connection);
    })

    .then(function(indexes) {
      var p = [];
      if (indexes.indexOf("groupNums") < 0) {
        console.log("Creating `groupNums` index on deck table.");
        p.push(r.db(config.dbName)
                   .table(config.deckTable)
                   .indexCreate(
                       "groupNums",
                       [ r.row('group')('coreNum'), r.row('group')('num') ])
                   .run(connection));
      } else {
        console.log(
            "Secondary index `groupNums` already exists in deck table.");
      }
      return Promise.all(p);
    })
    // Index for table of words to cover
    .then(function() {
      console.log("Getting indexes on dictionary table.");
      return r.db(config.dbName)
          .table(config.headwordsTable)
          .indexList()
          .run(connection);
    })

    .then(function(indexes) {
      if (indexes.indexOf("headwords") < 0) {
        console.log("Creating `headwords` index on dictionary table.");
        return r.db(config.dbName)
            .table(config.headwordsTable)
            .indexCreate("headwords", {multi : true})
            .run(connection);
      }
      console.log("Secondary index `headwords` already exists in dict table.");
      return [];
    })
    // Index for dictonary table
    .then(function() {
      console.log("Getting indexes on corewords table.");
      return r.db(config.dbName)
          .table(config.corewordsTable)
          .indexList()
          .run(connection);
    })

    .then(function(indexes) {
      if (indexes.indexOf("sourceNum") < 0) {
        console.log("Creating number index on corewords table.");
        return r.db(config.dbName)
            .table(config.corewordsTable)
            .indexCreate("sourceNum", r.row("source")("num"))
            .run(connection);
      }
      console.log("Secondary index `sourceNum` already exists in corewords.");
      return [];
    })
    // Two indexes for example sentences table
    .then(function() {
      console.log("Getting indexes on examples table.");
      return r.db(config.dbName)
          .table(config.examplesTable)
          .indexList()
          .run(connection);
    })

    .then(function(indexes) {
      var promises = [];
      var mkIndex = function(name, fn, opt) {
        if (indexes.indexOf(name) < 0) {
          console.log("Creating `" + name + "` index for sentences.");
          promises.push(r.db(config.dbName)
              .table(config.examplesTable)
              .indexCreate(name, fn, opt)
              .run(connection));
        } else {
          console.log("Secondary index `" + name + "` exists.");
        }
      };
      mkIndex('numChars', r.row('numChars')('total'));
      mkIndex('numKanji', r.row('numChars')('kanji'));
      mkIndex('numKatakana', r.row('numChars')('katakana'));
      mkIndex('numHiragana', r.row('numChars')('hiragana'));

      mkIndex('headwords', r.row('tags')('headword'), {multi : true});

      // The arbitrary function is building, for each document, an array of
      // 2-tuples. The length of this array is equal to the number of tags
      // (i.e., `obj.tags.length`). And its contents are ["headword",
      // senseNumber]. In plain JS, this is equivalent to
      // sentences.map(function(obj){return _.zip(_.pluck(obj.tags,"headword"),
      // _.pluck(obj.tags, "sense"))}).
      mkIndex('headwordsSense', function(obj) {
        return obj("tags")
            .map(function(tag) { return [ tag("headword"), tag("sense") ]; });
      }, {multi : true});

      mkIndex('headwordsSenseNumChars', function(obj) {
        return obj("tags").map(function(tag) {
          return [ tag("headword"), tag("sense"), obj('numChars')('total') ];
        });
      }, {multi : true});

      return Promise.all(promises);
    })

    .then(function() {
      console.log("All done, closing connection.");
      return connection.close()
    })

    .catch(console.error.bind(console, 'Error thrown!'));

