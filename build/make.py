"""Assemble dist/ratni-atlas.html (artifact body) and dist/test.html (standalone wrapper for local tests)."""
import re, os
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

R = ROOT
css_leaf = open(R + 'build/leaflet.min.css').read()
css_leaf = re.sub(r'background-image:url\(images/[^)]*\);?', '', css_leaf)
css_leaf = re.sub(r'url\(images/[^)]*\)', 'none', css_leaf)
css = open(R + 'src/style.css').read()
body = open(R + 'src/body.html').read()
mapdata = open(R + 'build/mapdata.js').read()
eradata = open(R + 'build/eradata.js').read()
js_files = sorted(f for f in os.listdir(R + 'src') if f.endswith('.js'))
js = '\n'.join(open(R + 'src/' + f).read().replace("'use strict';", '') for f in js_files)

import hashlib
BUILD = hashlib.sha1((css + body + mapdata + eradata + js).encode()).hexdigest()[:8]  # online: only the same build plays together

LEAFLET_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
LEAFLET_ALT = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'

page = f'''<title>Overtake</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Sans+Condensed:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap" rel="stylesheet">
<style>{css_leaf}
{css}
#app{{touch-action:none}}#sheet,.screen{{touch-action:pan-y}}</style>
{body}
<script>{mapdata}</script>
<script>{eradata}</script>
<script>
function __raMain(){{
'use strict';
{js}
RA.BUILD = '{BUILD}';
new RA.App().boot();
}}
function __raFallback(){{
  var s=document.createElement('script');
  s.src='{LEAFLET_ALT}';
  s.onload=__raMain;
  s.onerror=function(){{document.getElementById('loadMsg').textContent='Ne mogu učitati kartu (Leaflet). Provjeri internet vezu pa osvježi stranicu.';}};
  document.head.appendChild(s);
}}
</script>
<script src="{LEAFLET_CDN}" onload="__raMain()" onerror="__raFallback()"></script>
'''
os.makedirs(R + 'dist', exist_ok=True)
open(R + 'dist/ratni-atlas.html', 'w').write(page)
test = '<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + page + '</body></html>'
open(R + 'dist/test.html', 'w').write(test)
print('page bytes', len(page.encode()), 'js bytes', len(js.encode()))
