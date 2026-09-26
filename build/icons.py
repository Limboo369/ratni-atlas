"""The app icons (plan phase 18) as PNG without any image library: a light ring ("O" of Overtake) around two red
chevrons pointing up, on the dark ground. Written to dist/icons/ by build/make.py (only when missing or this file changed).
Codex may replace the design (C1: app icon); keep the file names and sizes."""
import math, struct, zlib


def png(w, h, rgba):
    raw = b''.join(b'\x00' + bytes(rgba[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


BG, RING, RED = (16, 23, 27), (232, 238, 240), (229, 72, 77)


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
                    r = math.hypot(u, v)
                    if abs(r - 0.30) < 0.055:
                        col = RING
                    # inside: two red chevrons pointing up (advance, take over)
                    for dy in (-0.07, 0.07):
                        if seg_dist(u, v, -0.14, 0.07 + dy, 0.0, -0.07 + dy) < 0.042 or seg_dist(u, v, 0.14, 0.07 + dy, 0.0, -0.07 + dy) < 0.042:
                            col = RED
                    for i in range(3):
                        acc[i] += col[i]
            o = (y * size + x) * 4
            out[o:o + 4] = bytes([acc[0] // (ss * ss), acc[1] // (ss * ss), acc[2] // (ss * ss), 255])
    return png(size, size, out)
