var cp = require('copy-paste'); // npm install node-copy-paste

module.exports = function() {
  return eval(cp.paste().replace(/\n\s*\./g, "."));
};
