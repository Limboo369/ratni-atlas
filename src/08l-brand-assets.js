'use strict';
/* Native vector identity. Shared by the launcher, ranked badges and the app icon.
   SVG strings are also available to the future install/manifest flow. */
RA.Brand = (() => {
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
  const crest = '<path d="M10 12 32 4l22 8v22c0 11-12 21-22 27C22 55 10 45 10 34Z" fill="#14252e" stroke="COLOR" stroke-width="2"/><path d="m16 16 16-6 16 6v18c0 8-8 15-16 21-8-6-16-13-16-21Z" stroke="COLOR" opacity=".35"/>';
  const forms = {
    unranked:['#80939c','<path d="M23 30h18M23 36h18"/>'],
    raider:['#b2aa99','<path d="m22 30 10-9 10 9M22 39l10-9 10 9"/>'],
    vanguard:['#8bbdcc','<path d="M32 18 21 34l11 12 11-12-11-16ZM32 26v11M5 23l6 4M5 31l6 4M59 23l-6 4M59 31l-6 4"/>'],
    warlord:['#d39882','<path d="m21 20 21 24M43 20 22 44M20 35l9 9M44 35l-9 9M21 20l1 8M43 20l-1 8"/>'],
    emperor:['#b7a7da','<path d="m19 26 7 5 6-11 6 11 7-5-3 15H22l-3-15ZM24 46h16M6 20v16M58 20v16"/>'],
    overlord:['#e2bd71','<path d="m19 26 7 5 6-11 6 11 7-5-3 15H22l-3-15ZM24 46h16M5 18v20l10 12M59 18v20L49 50M1 26l4 5 4-5M1 34l4 5 4-5M63 26l-4 5-4-5M63 34l-4 5-4-5"/>'],
  };
  const badges = Object.fromEntries(Object.entries(forms).map(([k,[color,shape]]) => [k,svg(crest.replaceAll('COLOR',color)+`<g stroke="${color}" stroke-width="2.6">${shape}</g>`)]));
  const mark = '<path d="M12 49 32 13l20 36H12Z" stroke="#dfc393" stroke-width="3"/><path d="m27 43 12-22M22 49h20" stroke="#e96356" stroke-width="5"/>';
  const appIcon = svg('<rect width="64" height="64" rx="13" fill="#0d1922"/>'+mark);
  const league = svg(crest.replaceAll('COLOR','#dfc393')+'<path d="m23 40 9-20 9 20M26 35h12M22 46h20" stroke="#dfc393" stroke-width="2.6"/>');
  const uri = (s) => 'data:image/svg+xml,'+encodeURIComponent(s);
  const sheet = document.createElement('style');
  sheet.textContent = Object.entries(badges).map(([k,s])=>`.lg-tier.lg-${k}{--rank-image:url("${uri(s)}")}`).join('\n')+`\n.league-mark{background-image:url("${uri(league)}")}`;
  document.head.appendChild(sheet);
  const favicon = document.querySelector('link[rel~="icon"]') || document.createElement('link');
  favicon.rel='icon';favicon.type='image/svg+xml';favicon.href=uri(appIcon);document.head.appendChild(favicon);
  return {badges,league,appIcon};
})();
