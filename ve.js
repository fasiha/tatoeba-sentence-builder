'using strict';

var spawn = require('child-process-promise').spawn;
var Promise = require('bluebird');
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
  var buffer = new Buffer(_.isArray(s) ? s.join('\n') : s);
  return Promise.resolve(spawn('ruby', ['cmd-ve.rb'], {capture : ['stdout']})
                             .progress(function(childProcess) {
                               childProcess.stdin.write(buffer);
                               childProcess.stdin.end();
                             }))
      .then(function(results) {
        var res = results.stdout.trim();
        if (raw) {
          return res;
        }
        res = res.split('\n').map(function(str) {
          return JSON.parse(str).map(simplifyVe)
        });
        return res.length === 1 ? res[0] : res;
      })
      .catch(function(err) { console.error('spawn/ve error: ', err); });
}
module.exports = makeVe;

