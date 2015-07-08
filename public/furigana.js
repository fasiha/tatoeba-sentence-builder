var furiganaUtils = (() => {
  var hanRegexp = XRegExp('\\p{Han}');
  var hasKanji = s => s.search(hanRegexp) >= 0;
  var nonKanaRegexp = XRegExp('[^\\p{Katakana}\\p{Hiragana}]');
  var needsFurigana = ve => ve.part_of_speech !== 'symbol' &&
                            ve.lemma !== '*' &&
                            ve.word.search(nonKanaRegexp) >= 0;
  function findPrePostfix(a, b) {
    var minLength = Math.min(a.length, b.length);

    // Important initialization and prefix search
    var preLen = minLength;
    for (var i = 0; i < minLength; i++) {
      if (a[i] !== b[i]) {
        preLen = i;
        break;
      }
    }

    // Similar search for postfix search plus an important initialization
    var postLen = minLength - preLen;
    for (var i = 0; i < minLength - preLen; i++) {
      if (a[a.length - i - 1] !== b[b.length - i - 1]) {
        postLen = i;
        break;
      }
    }

    return {
      a : a.substring(preLen, a.length - postLen),
      b : b.substring(preLen, b.length - postLen),
      pre : a.substring(0, preLen),
      post : a.substring(a.length - postLen, a.length)
    };
  }

  function veArrayToFuriganaMarkup(ves) {
    return ves.map(v => needsFurigana(v)
                            ? wordReadingToRuby(v.word, kataToHira(v.reading))
                            : v.word)
        .join('');
  }

  function wordReadingToRuby(word, reading) {
    var strip = findPrePostfix(word, reading);
    return strip.pre +
           (strip.a.length
                ? "<ruby>" + strip.a + "<rp>(</rp><rt>" +
                      (strip.b.length ? strip.b
                                      : _.repeat("?", strip.a.length)) +
                      "</rt><rp>)</rp></ruby>"
                : "") +
           strip.post;
  }

  const hiraString =
      "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
  const kataString =
      "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";

  var kataToHiraTable = _.object(kataString.split(''), hiraString.split(''));
  var kataToHira = str =>
      str.split('').map(c => kataToHiraTable[c] || c).join('');

  return {veArrayToFuriganaMarkup, needsFurigana};
})();
