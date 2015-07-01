"use strict";
var ve = require('../ve');
var debug = require('debug')('routes');
var express = require('express');
var router = express.Router();
var config = require('../config');

var passwordless = require('passwordless');

router.get('/', function(req, res) { res.render('index', {user : req.user}); });

router.get('/restricted', passwordless.restricted(), function(req, res) {
  res.render('restricted', {user : req.user});
});

router.get('/login', function(req, res) { res.render('login', {user : req.user}); });

router.get('/loginstatus', function(req, res) {
  console.log(req.user);
  res.json(req.user ? true : null);
});

router.get('/logout', passwordless.logout(),
           function(req, res) { res.redirect('/'); });

router.post('/sendtoken',
            passwordless.requestToken(function(user, delivery, callback) {
              if (config.adminEmails.indexOf(user) >= 0) {
                callback(null, user);
              } else {
                callback(null, null);
              }
            }),
            function(req, res) { res.render('sent'); });

var r = require('rethinkdb');
var connection = null;
var connectionPromise = r.connect(
    {host : config.dbHost, port : config.dbPort, db : config.dbName});

router.get('/v2/headwords/:words', passwordless.restricted(), function(req, res) {
  var words = req.params.words.split(',');
  connectionPromise
      .then(function(c) {
        connection = c;
        return r.db(config.dbName)
            .table(config.headwordsTable)
            .getAll(r.args(words), {index : 'headwords'})
            .without('id', 'modifiedTime')
            .distinct()
            // .distinct serves two purposes: (1) convert getAll's stream to
            // array and (2) get rid of any possible repeated entries
            .run(connection);
      })
      .then(function(results) {
        res.json(results);
        return 1;//return connection.close();
      })
      //.catch(console.error.bind(console, 'Error thrown!'));
});

var requestDefaultToStartStop = function(req, def) {
  var page = req.query.page ? +req.query.page : null;
  var start = page ? Math.max(0, page - 1) * def : 0;
  var end = page ? Math.max(1, page) * def : def;
  return [ start, end ];
};
router.get('/v2/sentences/:headword/:sense', passwordless.restricted(), function(req, res) {
  connectionPromise
      .then(function(c) {
        connection = c;
        var defaultSize = 10;
        var startEnd = requestDefaultToStartStop(req, defaultSize);

        return r.db(config.dbName)
            .table(config.examplesTable)
            .between([ req.params.headword, +req.params.sense, r.minval ],
                     [ req.params.headword, +req.params.sense, r.maxval ],
                     {index : 'headwordsSenseNumChars'})
            .orderBy({index : 'headwordsSenseNumChars'})
            .slice(startEnd[0], startEnd[1])
            .coerceTo('array')
            .pluck('japanese', 'english', 'tags')
            .run(connection);
      })
      .then(function(results) {
        res.json(results);
        return 1;//return connection.close();
      })
});

router.get('/v2/corewords', passwordless.restricted(), function(req, res) {
  connectionPromise.then(function(c) {
                     connection = c;
                     var defaultSize = 100;
                     var startEnd = requestDefaultToStartStop(req, defaultSize);

                     return r.table(config.corewordsTable)
                         .orderBy({index : 'sourceNum'})
                         .slice(startEnd[0], startEnd[1])
                         .without('id', 'modifiedTime')
                         .coerceTo('array')
                         .run(connection);
                   })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

router.get('/v2/deck', passwordless.restricted(), function(req, res) {
  connectionPromise.then(function(c) {
                     connection = c;
                     return r.table(config.deckTable)
                         .orderBy({index : "groupNums"})
                         .without('modifiedTime')
                         .coerceTo('array')
                         .run(connection);
                   })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

router.get('/v2/deck/:corenum', passwordless.restricted(), function(req, res) {
  connectionPromise.then(function(c) {
                     connection = c;
                     return r.table(config.deckTable)
                         .between([ +req.params.corenum, r.minval ],
                                  [ +req.params.corenum, r.maxval ],
                                  {index : "groupNums"})
                         .orderBy({index : 'groupNums'})
                         .coerceTo('array')
                         .without('modifiedTime')  // send ID in case of edits
                         .run(connection);
                   })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

// New sentence from example sentences
router.post('/v2/deck', passwordless.restricted(), function(req, res) {
  var obj = req.body;
  if ('id' in obj) {
    obj = _.omit(obj, 'id');  // Problematic? Was causing node to hang?
  }
  var vePromise = ve(obj.japanese);
  connectionPromise.then(function(c) {
                     connection = c;
                     return Promise.all([
                       r.table(config.deckTable)
                           .between([ obj.group.coreNum, r.minval ],
                                    [ obj.group.coreNum, r.maxval ],
                                    {index : "groupNums"})
                           .count()
                           .run(connection),
                       vePromise
                     ])
                   })
      .then(function(resVe) {
        var count = resVe[0];
        var veResult = resVe[1];

        obj.ve = veResult;
        obj.group.num = count;

        return r.table(config.deckTable)
            .insert(obj)
            .run(connection, {durability : 'soft'});
      })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

// Edited sentence
router.put('/v2/deck/:id', passwordless.restricted(), function(req, res) {
  var obj = req.body;
  if (req.params.id !== obj.id) {
    res.status(404);
    res.json({err : 'ID in body object did not match ID in URL'});
    return;
  }
  Promise.all([ connectionPromise, obj.japanese ? ve(obj.japanese) : null ])
      .then(function(connVe) {
        connection = connVe[0];
        var veResult = connVe[1];
        // obj.ve = veResult;
        return r.table(config.deckTable)
            .get(obj.id)
            .update(obj)
            .run(connection, {durability : 'soft'});
      })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

router.delete('/v2/deck/:id', passwordless.restricted(), function(req, res) {
  connectionPromise
      .then(function(c) {
        connection = c;
        return r.table(config.deckTable)
            .get(req.params.id)
            .delete()
            .run(connection, {durability : 'soft'});
      })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

module.exports = router;
