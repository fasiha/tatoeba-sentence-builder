"use strict";
var ve = require('../ve');
var debug = require('debug')('routes');
var express = require('express');
var router = express.Router();
var config = require('../config');

var passwordless = require('passwordless');

router.get('/', function(req, res) { res.render('index', {user : req.user}); });

router.get('/restricted', function(req, res) {
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

router.get('/v2/headwords/:words', function(req, res) {
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
        return 1;
      })
});

var requestDefaultToStartStop = function(req, def) {
  var page = req.query.page ? +req.query.page : null;
  var start = page ? Math.max(0, page - 1) * def : 0;
  var end = page ? Math.max(1, page) * def : def;
  return [ start, end ];
};
router.get(
    '/v2/sentences/:headword/:sense',
    function(req, res) {
      // Headword readings: if available, require one of these to be present in
      // all sentences returned
      var readings = (req.query.readings || '').split(',');
      var headword = req.params.headword;

      connectionPromise
          .then(function(c) {
            connection = c;
            var defaultSize = 10;
            var startEnd = requestDefaultToStartStop(req, defaultSize);

            return r.db(config.dbName)
                .table(config.examplesTable)
                .between([ headword, +req.params.sense, r.minval ],
                         [ headword, +req.params.sense, r.maxval ],
                         {index : 'headwordsSenseNumChars'})
                .orderBy({index : 'headwordsSenseNumChars'})
                .filter(function(obj) {
                  return readings.length
                             ? obj('tags')
                                   .filter(function(t) {
                                     return t('headword').eq(headword)
                                   })
                                   .filter(function(tag) {
                                     return r.expr(readings)
                                         .contains(tag('reading'))
                                         .or(r.expr(readings)
                                                 .contains(tag('form')));
                                   })
                                   .isEmpty()
                                   .not()
                             : true;
                })
                .slice(startEnd[0], startEnd[1])
                .coerceTo('array')
                .pluck('japanese', 'english', 'tags')
                .run(connection);
          })
          .then(function(results) {
            res.json(results);
            return 1;
          })
    });

router.get('/v2/corewords', function(req, res) {
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

router.get('/v2/deck', function(req, res) {
  var extraData = (req.query.extra || '') === 'true';

  connectionPromise.then(function(c) {
                     connection = c;
                     if (extraData) {
                       return r.table(config.deckTable)
                           .orderBy({index : "groupNums"})
                           .map(o => o.merge(
                                    r.object('corewordData',
                                             r.table(config.corewordsTable)
                                                 .getAll(o('group')('coreNum'),
                                                         {index : 'sourceNum'})
                                                 .nth(0))))
                           .map(o => o.merge(r.object(
                                    'dictionaryData',
                                    r.table(config.headwordsTable)
                                        .getAll(
                                            r.args(o('corewordData')('words')),
                                            {index : 'headwords'})
                                        .distinct())))
                           /*
                           .group(r.row('group')('coreNum'),
                                  r.row('group')('senseNum'))
                           */
                           .coerceTo('array')
                           .run(connection);
                     }
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

router.get('/v2/deck/:corenum', function(req, res) {
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
router.post('/v2/deck', function(req, res) {
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
router.put('/v2/deck/:id', function(req, res) {
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

        var japaneseChanged = req.query.japaneseChanged;
        if (typeof japaneseChanged === 'undefined') {
          // Default: if we don't know, assume it's changed, overwrite furigana.
          japaneseChanged = true;
        } else {
          // convert from string to bool
          japaneseChanged = japaneseChanged === 'true';
        }
        if (japaneseChanged) {
          obj.ve = veResult;
        }

        var returnChanges = req.query.returnChanges;
        if (typeof returnChanges === 'undefined') {
          returnChanges = false;
        } else {
          returnChanges = returnChanges === 'true';
        }

        return r.table(config.deckTable)
            .get(obj.id)
            .update(obj, {returnChanges : returnChanges})
            .run(connection, {durability : 'soft'});
      })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

router.delete('/v2/deck/:id', function(req, res) {
  connectionPromise.then(function(c) {
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
