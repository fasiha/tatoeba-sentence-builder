"use strict";
var fs = require('fs');
var _ = require('lodash');

module.exports = {
  read : function(file) { return fs.readFileSync(file, {encoding : 'utf8'}); },

  readJSON : function(file) { return JSON.parse(this.read(file)); },

  writeJSON : function(file, obj) {
    if (typeof file !== 'string') {
      throw new Error('file name must be string');
    }
    fs.writeFileSync(file, JSON.stringify(obj, null, 1));
  },

  writeLineDelimitedJSON : function(file, obj) {
    if (typeof file !== 'string') {
      throw new Error('file name must be string');
    }
    if (_.isArray(obj)) {
      fs.writeFileSync(file, obj.map(JSON.stringify).join('\n'));
    } else if (_.isObject(obj)) {
      // Convert the object into an array of key-val pairs and a pair per line
      this.writeLineDelimitedJSON(file, _.map(obj, function(val, key) {
        return {key : key, val : val};
      }));
    } else {
      console.warn('Input not array or object. Writing plain JSON.');
      this.writeJSON(file + '.json', obj);
    }
  },

  readLineDelimitedJSON : function(file, wantHash) {
    if (typeof wantHash === 'undefined') {
      wantHash = false;
    }
    var arr = this.read(file).trim().split('\n').map(JSON.parse);
    if (!wantHash) {
      return arr;
    }
    return _.object(_.pluck(arr, 'key'), _.pluck(arr, 'val'));
  },

  // Lodash & underscore have a function `invert` which takes an object's keys
  // and values and swaps them. But this library function can't deal with values
  // that are arrays. Sometimes we want `invert` to produce an output object
  // whose keys are scalars inside those arrays (which were values in the input
  // object).
  arrayAwareInvert : function(obj, multi) {
    if (typeof multi === 'undefined') {
      multi = false;
    }
    var res = {};
    for (var p in obj) {
      var arr = obj[p];
      for (var i in arr) {
        if (!multi) {
          res[arr[i]] = p;
        } else {
          (res[arr[i]] || (res[arr[i]] = [])).push(p);
        }
      }
    }
    return res;
  },

  arrayAwareObject : function(arrOfKeys, vals, multi) {
    if (arrOfKeys.length !== vals.length) {
      throw "Keys and values arrays need to be same length";
    }
    if (typeof multi === 'undefined') {
      multi = false;
    }
    var obj = {};
    arrOfKeys.forEach(function(keys, idx) {
      keys.forEach(function(key) {
        if (multi) {
          (obj[key] || (obj[key] = [])).push(vals[idx]);
        } else {
          obj[key] = vals[idx];
        }
      });
    });
    return obj;
  },

  sum : _.sum,

  mean : function(x) { return this.sum(x) / x.length; },

  median : function(x) {
    var s = x.sort();
    return x.length % 2 === 1 ? s[Math.floor(x.length / 2)]
                              : 0.5 * (s[x.length / 2 - 1] + s[x.length / 2]);
  },

  withDate : function(v) {
    return v.map(function(o) {
      return _.merge(o, {modifiedTime : new Date()});
    });
  },

  nonUnique : function(v) {
    return _.pairs(_.groupBy(v)).filter(function(v) { return v[1].length > 1 });
  }
};

