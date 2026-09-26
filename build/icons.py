"""Installable Overtake icons: same gold triangle/red slash as RA.Brand.appIcon. Keep manifest sizes and maskable safe area; no image dependency."""
import math, struct, zlib


def png(w, h, rgba):
    raw = b''.join(b'\x00' + bytes(rgba[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


BG, GOLD, RED = (13, 25, 34), (223, 195, 147), (233, 99, 86)


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy, wx, wy = bx - ax, by - ay, px - ax, py - ay
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    return math.hypot(wx - t * vx, wy - t * vy)


def icon(size, maskable=False):
    k = 0.78 if maskable else 1.0  # maskable: everything inside the safe circle
    out = bytearray(size * size * 4)
    ss = 2
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    u = ((x + (sx + 0.5) / ss) / size - 0.5) / k
                    v = ((y + (sy + 0.5) / ss) / size - 0.5) / k
                    col = BG
                    # Same 64 x 64 coordinates as the vector favicon.
                    u, v = u * 64 + 32, v * 64 + 32
                    for ax, ay, bx, by in ((12, 49, 32, 13), (32, 13, 52, 49), (52, 49, 12, 49)):
                        if seg_dist(u, v, ax, ay, bx, by) < 1.5:
                            col = GOLD
                    for ax, ay, bx, by in ((27, 43, 39, 21), (22, 49, 42, 49)):
                        if seg_dist(u, v, ax, ay, bx, by) < 2.5:
                            col = RED
                    for i in range(3):
                        acc[i] += col[i]
            o = (y * size + x) * 4
            out[o:o + 4] = bytes([acc[0] // (ss * ss), acc[1] // (ss * ss), acc[2] // (ss * ss), 255])
    return png(size, size, out)
