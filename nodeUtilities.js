"use strict";
var fs = require('fs');

module.exports = {
  read : function(file) { return fs.readFileSync(file, {encoding : 'utf8'}); },

  readJSON : function(file) { return JSON.parse(this.read(file)); },

  writeJSON : function(file, obj) {
    if (typeof file !== 'string') {
      throw new Error('file name must be string');
    }
    fs.writeFileSync(file, JSON.stringify(obj, null, 1));
  },
  // Lodash & underscore have a function `invert` which takes an object's keys and
  // values and swaps them. But this library function can't deal with values that
  // are arrays. Sometimes we want `invert` to produce an output object whose keys
  // are scalars inside those arrays (which were values in the input object).
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
  }
};
