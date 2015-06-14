var debug = require('debug')('routes');
var express = require('express');
var router = express.Router();

const NO_V1 = true;
if (!NO_V1) {
  var jmdict = require('../serve_jmdict.js');
  var sentences = require('../serve_sentences.js');
}
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
              callback(null, user);
            }),
            function(req, res) { res.render('sent'); });
if (!NO_V1) {
  router.get('/v1/headwords/:words', function(req, res) {
    debug('headwords params:', req.params);
    var words = req.params.words.split(',');
    res.json(jmdict.lookupHeadword(words));
  });

  router.get('/v1/readings/:words', function(req, res) {
    res.json(jmdict.lookupHeadword(req.params.words.split(',')));
  });

  router.get('/v1/sentences/:headword/:sense', function(req, res) {
    debug('sentences params:', req.params);
    res.json(sentences.headwordSenseToSentences(req.params.headword,
                                                req.params.sense));
  });
}
var r = require('rethinkdb');
var config = require('../config');
var connection = null;
var connectionPromise = r.connect({host : config.dbHost, port : config.dbPort});

router.get('/v2/headwords/:words', function(req, res) {
  var words = req.params.words.split(',');
  connectionPromise
      .then(function(c) {
        connection = c;
        return r.db(config.dbName)
            .table(config.headwordsTable)
            .getAll(r.args(words), {index : 'headwords'})
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

router.get('/v2/sentences/:headword/:sense', function(req, res) {
  connectionPromise
      .then(function(c) {
        connection = c;

        return r.db(config.dbName)
            .table(config.examplesTable)
            .getAll([ req.params.headword, +req.params.sense ],
                    {index : 'headwordsSense'})
            .limit(2)
            .pluck('japanese', 'english')
            // .distinct() does the trick too: converting getAll's stream to an
            // array
            .coerceTo('array')
            .run(connection);
      })
      .then(function(results) {
        res.json(results);
        return 1;//return connection.close();
      })
});

module.exports = router;
