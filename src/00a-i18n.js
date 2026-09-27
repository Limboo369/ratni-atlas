'use strict';
/* Languages (Darko, 27. 9.): English is the game's language and the language of the code; Serbian (Latin) is a
   translation, chosen in the settings (localStorage ra_lang; switching reloads the page).
   RA.t('English text with {0} and {1}', a, b): the text in the player's language with the values put in.
   Serbian texts live in RA.SR (src/00b-sr.js), keyed by the English text; a text missing there stays English.
   Two Serbian texts with the same English (gender: 'Predsjednik' / 'Predsjednica') are told apart by a mark at the end
   of the key that is never shown: RA.t('President{=2}').
   Place names (states, cities) come from the map data in Bosnian/Serbian: RA.tn(name) gives the English name
   (RA.EN_NAMES, src/00c-names.js) when the language is English. The simulation runs in node too (no DOM here). */
RA.LANGS = { en: 'English', sr: 'Srpski' };
RA.LANG = (() => {
  try {
    const l = typeof localStorage !== 'undefined' && localStorage.getItem('ra_lang');
    return l && RA.LANGS[l] ? l : 'en';
  } catch (_) {
    return 'en';
  }
})();
RA.LOCALE = RA.LANG === 'sr' ? 'sr-Latn' : 'en-GB'; // dates, sorting
RA.DEC = RA.LANG === 'sr' ? ',' : '.'; // decimal mark (49.4M / 49,4M)
RA.SR = RA.SR || {};
RA.EN_NAMES = RA.EN_NAMES || {};
RA.t = function (s) {
  let r = RA.LANG === 'sr' && Object.prototype.hasOwnProperty.call(RA.SR, s) ? RA.SR[s] : s;
  if (r.charCodeAt(r.length - 1) === 125 && /\{=\d+\}$/.test(r)) r = r.replace(/\{=\d+\}$/, ''); // context mark: 'President{=2}'
  if (arguments.length > 1) {
    const a = arguments;
    r = r.replace(/\{(\d+)\}/g, (m, i) => (+i + 1 < a.length ? String(a[+i + 1]) : m));
  }
  return r;
};
RA.tn = function (name) {
  return RA.LANG === 'en' && typeof name === 'string' && Object.prototype.hasOwnProperty.call(RA.EN_NAMES, name) ? RA.EN_NAMES[name] : name;
};
RA.setLang = function (l) {
  if (!RA.LANGS[l]) return;
  try {
    localStorage.setItem('ra_lang', l);
  } catch (_) {}
  location.reload();
};
