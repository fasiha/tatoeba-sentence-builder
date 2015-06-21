var debug = require('debug')('routes');
var express = require('express');
var router = express.Router();

var passwordless = require('passwordless');

router.get('/', function(req, res) { res.render('index', {user : req.user}); });

router.get('/restricted', passwordless.restricted(), function(req, res) {
  res.render('restricted', {user : req.user});
});

router.get('/login', function(req, res) { res.render('login', {user : req.user}); });

router.get('/logout',
           passwordless.logout(), function(req, res) { res.redirect('/'); });

// Simply accept every user
// usually you would want something like:
// User.find({email: user}, callback(ret) {
// 		if(ret)
// 			callback(null, ret.id)
// 		else
// 			callback(null, null)
// })
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
var config = require('../config');
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
router.get('/v2/sentences/:headword/:sense', function(req, res) {
  connectionPromise
      .then(function(c) {
        connection = c;
        const defaultSize = 10;
        var startEnd = requestDefaultToStartStop(req, defaultSize);

        return r.db(config.dbName)
            .table(config.examplesTable)
            .getAll([ req.params.headword, +req.params.sense ],
                    {index : 'headwordsSense'})
            .pluck('japanese', 'english', 'tags')
            .distinct()
            .slice(startEnd[0], startEnd[1])
            .run(connection);
      })
      .then(function(results) {
        res.json(results);
        return 1;//return connection.close();
      })
});

router.get('/v2/corewords', function(req, res) {
  connectionPromise.then(function(c) {
                     connection = c;
                     const defaultSize = 100;
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

router.get('/v2/deck/:corenum', function(req, res) {
  connectionPromise.then(function(c) {
                     connection = c;
                     return r.table(config.deckTable)
                         .orderBy({index : "groupNums"})
                         .filter(
                             r.row('group')('coreNum').eq(req.params.corenum))
                         .without('modifiedTime')
                         .coerceTo('array')
                         .run(connection);
                   })
      .then(function(results) {
        res.json(results);
        return 1;
      });
});

module.exports = router;
