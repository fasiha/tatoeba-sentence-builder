var debug = require('debug')('routes');
var express = require('express');
var router = express.Router();

var jmdict = require('../serve_jmdict.js');

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

router.get('/headwords/:words', function(req, res) {
  debug('Lookup params:',req.params);
  var words = req.params.words.split(',');
  res.json(jmdict.lookupHeadword(words));
});

router.get('/readings/:words', function(req, res) {
  res.json(jmdict.lookupHeadword(req.params.words.split(',')));
});

module.exports = router;
