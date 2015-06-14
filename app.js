var siteConfig = require('./config.js');

var express = require('express');
var compression = require('compression');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var bodyParser = require('body-parser');

var passwordless = require('passwordless');
var MemoryStore = require('passwordless-memorystore');

var routes = require('./routes/index');

var app = express();

var host = 'http://localhost:3000';

// Setup of Passwordless
passwordless.init(new MemoryStore());
passwordless.addDelivery(function(tokenToSend, uidToSend, recipient, callback) {
  // Print out token
  var result = 'Hello! You can now access your account here: ' + host + '?token=' +
               tokenToSend + '&uid=' + encodeURIComponent(uidToSend);
  console.log(result);
  callback(null);
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
  resave : false,
  saveUninitialized : false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data-static', express.static(path.join(__dirname, 'data-static')));
// Passwordless middleware
app.use(passwordless.sessionSupport());
app.use(passwordless.acceptToken({successRedirect : '/'}));

app.use('/', routes);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {message : err.message, error : err});
});

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + server.address().port);
});
