var siteConfig = require('./config.js');

var express = require('express');
var compression = require('compression');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var bodyParser = require('body-parser');
var RDBStore = require('session-rethinkdb')(expressSession);

var passwordless = require('passwordless');
var RethinkDBStore = require('passwordless-rethinkdbstore');
var sendgrid = require('sendgrid')(siteConfig.sendgridApiKey);

var routes = require('./routes/index');

var app = express();

var host = 'http://' + siteConfig.webHost + ':' + siteConfig.webPort;

// Setup of Passwordless
passwordless.init(new RethinkDBStore({
  host : siteConfig.dbHost,
  port : siteConfig.dbPort,
  db : siteConfig.dbName
}));
passwordless.addDelivery(function(tokenToSend, uidToSend, recipient, callback) {
  // Print out token
  var url =
      host + '?token=' + tokenToSend + '&uid=' + encodeURIComponent(uidToSend);
  var result = 'Hi! Follow this link to log in to your Unlock account:\n\n' +
               url + '\n\nMuch love,\n〜Unlock Japanese';
  console.log(result);
  if (siteConfig.production) {
    sendgrid.send(
        {
          to : recipient,
          from : 'wuzzyview@gmail.com',
          fromName : 'Japanese Unlocked',
          subject : 'Your passwordless login to Unlocked',
          text : result
        },
        function(err, json) {
          if (err) {
            console.error(err);
          }
          console.log(json);
          callback(err);
        });
  } else {
    callback(null);
  }
});

// First things first
app.use(compression());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Standard express setup
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : false}));
app.use(cookieParser());
app.use(expressSession({
  secret : siteConfig.sessionSecret,
  resave : true,
  saveUninitialized : false,
  store : new RDBStore({
    db : siteConfig.dbName,
    servers : [ {host : siteConfig.dbHost, port : siteConfig.dbPort} ]
  })
}));
app.disable('x-powered-by');

// Passwordless middleware
app.use(passwordless.sessionSupport());
app.use(passwordless.acceptToken({successRedirect : '/'}));

// Routes
app.use('/', routes);
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/data-static', express.static(path.join(__dirname, 'data-static')));

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
if (siteConfig.production) {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {message : err.message, error : err});
  });
}

app.set('port', siteConfig.webPort);

var server = app.listen(app.get('port'), function() {
  console.log(
      'Express server listening on port ' + server.address().port,
      ' in ' + (siteConfig.production ? 'PRODUCTION!' : 'dev') + ' mode.');
});
