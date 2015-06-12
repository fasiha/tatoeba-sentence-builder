"using strict";

var Promise = require("bluebird");
var exec = require("child-process-promise").exec;
var _ = require('lodash');
var config = require('./config');

function simplifyMecab(m) { return _.pick(m, 'literal lemma pos'.split(' ')); }

function simplifyVe(ve) {
  var o = _.pick(ve, 'word lemma part_of_speech'.split(' '));
  o.reading = ve.extra.reading;
  o.transcription = ve.extra.transcription;
  o.tokens = ve.tokens ? ve.tokens.map(simplifyMecab) : ve.tokens;
  return o;
}

function makeVe(s, raw) {
  if (typeof raw === 'undefined') {
    raw = false;
  }
  return exec('echo "' + s + '" | ruby cmd-ve.rb')
      .then(function(contents) {
        var stdout = contents.stdout;
        if (raw) {
          return stdout;
        }
        return JSON.parse(stdout).map(simplifyVe);
      })
      .catch(function(err) { console.error('Error thrown!', err.stack); });
}

module.exports = makeVe;
