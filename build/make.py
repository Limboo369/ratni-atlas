"""Assemble dist/ratni-atlas.html (artifact body) and dist/test.html (standalone wrapper for local tests).
Europe is inlined; the world map (build/svijet/map.json, era_<id>.json) is copied to dist/data/svijet/ (served as /data/svijet/)."""
import re, os, glob, shutil
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

import base64, json
# painted icons (Darko 28. 9.): src/art/<icon name>.webp|png replace the drawn icon of that name in the page (window.RA_ART)
art = {}
for f in sorted(glob.glob(R + 'src/art/*.webp') + glob.glob(R + 'src/art/*.png')):
    n, ext = os.path.splitext(os.path.basename(f))
    art[n] = 'data:image/' + ext[1:] + ';base64,' + base64.b64encode(open(f, 'rb').read()).decode()
artjs = 'window.RA_ART=' + json.dumps(art) + ';'
js = artjs + '\n' + js

import hashlib
world = sorted(glob.glob(R + 'build/svijet/map.json') + glob.glob(R + 'build/svijet/era_*.json'))
wbytes = b''.join(open(f, 'rb').read() for f in world)
BUILD = hashlib.sha1((css + body + mapdata + eradata + js).encode() + wbytes).hexdigest()[:8]  # online: only the same build (and world data) plays together

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
  s.onerror=function(){{document.getElementById('loadMsg').textContent='Cannot load the map (Leaflet). Check your internet connection and refresh the page.';}};
  document.head.appendChild(s);
}}
</script>
<script src="{LEAFLET_CDN}" onload="__raMain()" onerror="__raFallback()"></script>
'''
os.makedirs(R + 'dist', exist_ok=True)
open(R + 'dist/ratni-atlas.html', 'w').write(page)
# the installable app (plan phase 18): manifest, service worker (/sw.js) and icons next to the page
APP_HEAD = ('<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#10171b">'
            '<link rel="icon" href="/icons/icon-192.png"><link rel="apple-touch-icon" href="/icons/icon-192.png">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
            # the install offer can come before the game has loaded: keep it for src/09h-app.js
            '<script>addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__raInstall=e;});</script>')
test = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + APP_HEAD + '</head><body>' + page + '</body></html>'
open(R + 'dist/test.html', 'w').write(test)
shutil.copyfile(R + 'build/pwa/manifest.webmanifest', R + 'dist/manifest.webmanifest')
open(R + 'dist/sw.js', 'w').write(open(R + 'build/pwa/sw.js').read().replace('__BUILD__', BUILD))
os.makedirs(R + 'dist/icons', exist_ok=True)
_ih = hashlib.sha1(open(R + 'build/icons.py', 'rb').read()).hexdigest()[:8]
_stamp = R + 'dist/icons/.v'
if not os.path.exists(_stamp) or open(_stamp).read() != _ih:
    import sys
    sys.path.insert(0, R + 'build')
    import icons
    for name, size, mask in (('icon-192', 192, False), ('icon-512', 512, False), ('maskable-512', 512, True)):
        open(R + f'dist/icons/{name}.png', 'wb').write(icons.icon(size, mask))
    open(_stamp, 'w').write(_ih)
os.makedirs(R + 'dist/data/svijet', exist_ok=True)
for f in world:
    shutil.copyfile(f, R + 'dist/data/svijet/' + os.path.basename(f))
print('page bytes', len(page.encode()), 'js bytes', len(js.encode()))
# the simulation alone (src/00–04) for the game server, which runs every Focus game itself (deploy/game/simhost.js)
os.makedirs(R + 'dist/sim', exist_ok=True)
sim = '\n'.join(open(R + 'src/' + f).read().replace("'use strict';", '') for f in js_files if re.match(r'0[0-4]', f))
open(R + 'dist/sim/sim.js', 'w').write(f"/* Overtake simulation, build {BUILD} (generated by build/make.py) */\n" + sim + f"\nRA.BUILD = '{BUILD}';\n")
shutil.copyfile(R + 'build/mapdata.js', R + 'dist/sim/mapdata.js')
shutil.copyfile(R + 'build/eradata.js', R + 'dist/sim/eradata.js')
