"use strict";
var fs = require('fs');

module.exports = {
  read : function(file) { return fs.readFileSync(file, {encoding : 'utf8'}); },
  writeJSON :
      function(file, obj) {
        if (typeof file !== 'string') {
          throw new Error('file name must be string');
        }
        fs.writeFileSync(file, JSON.stringify(obj, null, 1));
      }
};
