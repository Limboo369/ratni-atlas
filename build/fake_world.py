"""Stand-in world data for tests (not the real world map): the embedded Europe re-packaged in the world files' format,
so the fetch / map switch / online preload path can run before build/svijet/ exists.
   python build/fake_world.py [out_dir]      (default dist/data/svijet)
Writes map.json (window.MAPDATA's object, meta.id 'svijet') and era_<id>.json (one window.ERADATA entry each)."""
import json, os, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else R + 'dist/data/svijet'


def load(name, prefix):
    s = open(R + 'build/' + name, encoding='utf8').read().strip()
    assert s.startswith(prefix)
    return json.loads(s[len(prefix):].rstrip(';'))


M = load('mapdata.js', 'window.MAPDATA=')
E = load('eradata.js', 'window.ERADATA=')
M['meta'].update(id='svijet', name='Cijeli svijet', lods=sorted({k.split('_')[1] for k in M['vec']}), minZoom=2, maxZoom=9.5,
                 winShare=0.6, overtimeMin=14)
os.makedirs(OUT, exist_ok=True)
json.dump(M, open(OUT + '/map.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
for k, v in E.items():
    json.dump(v, open(f'{OUT}/era_{k}.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print('fake world ->', OUT, sorted(os.listdir(OUT)))
