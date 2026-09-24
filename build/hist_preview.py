"""Render a historical-basemaps year onto the game grid as a labelled PNG (for choosing eras)."""
import sys, random, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from hist_scan import raster, land, W, H
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'  # repository root

S = 2
font = ImageFont.load_default()
for year in sys.argv[1:]:
    feats, arr = raster(year)
    own = np.where(land, arr, 0)
    rng = random.Random(3)
    cols = [(0, 0, 0)] + [tuple(int(v * 255) for v in colorsys.hls_to_rgb(rng.random(), 0.55, 0.6)) for _ in feats]
    img = np.zeros((H, W, 3), np.uint8)
    img[:] = (40, 60, 90)
    lab = np.array(cols, np.uint8)[own]
    img[land] = lab[land]
    img[land & (own == 0)] = (240, 240, 240)
    im = Image.fromarray(img).resize((W * S, H * S), Image.NEAREST)
    dr = ImageDraw.Draw(im)
    cnt = np.bincount(own.ravel(), minlength=len(feats) + 1)
    ys, xs = np.indices((H, W))
    for idx, (i, pr, polys) in enumerate(feats):
        n = cnt[idx + 1]
        if n < 120:
            continue
        m = own == idx + 1
        cx, cy = xs[m].mean(), ys[m].mean()
        name = str(pr.get('NAME'))[:22]
        dr.text((cx * S - 3 * len(name), cy * S - 5), name, fill=(0, 0, 0), font=font)
    os.makedirs(ROOT + 'build/shots', exist_ok=True)
    im.save(ROOT + f'build/shots/hist_{year}.png')
    print('saved', year)
