"""Writes ClaudeCorners.ttf: four PUA glyphs, each a monospace cell filled except for a quarter-circle corner cut.

Pure standard library. Metrics match Cascadia Code so the glyphs fill a terminal cell exactly.
U+E9F0 top-left, U+E9F1 top-right, U+E9F2 bottom-left, U+E9F3 bottom-right.
"""
import math
import struct
import sys

UPM, ADV, ASC, DESC = 2048, 1200, 1900, -480
R = ADV  # corner radius in font units (about 9.6 px at a 9 px cell)
SEG = 4  # quadratic segments per quarter circle
EXT = 70  # the inner edge overshoots the cell a little so no hairline shows between rows
EXT_X = -40  # right outer edge: +20 bled 1 px outside the cell, -100 sat 1 px inside, so aim between
MID_Y = ASC + DESC  # y -> MID_Y - y mirrors the cell vertically


def top_left():
    """Clockwise contour of the cell minus the top-left quarter-circle cut, as (x, y, on_curve)."""
    cx, cy = ADV, ASC - R
    pts = [(0, DESC - EXT, True), (0, cy, True)]
    for i in range(SEG):
        a0 = math.radians(180 - 90 * i / SEG)
        a1 = math.radians(180 - 90 * (i + 1) / SEG)
        am = (a0 + a1) / 2
        k = R / math.cos((a0 - a1) / 2)
        pts.append((round(cx + k * math.cos(am)), round(cy + k * math.sin(am)), False))
        pts.append((round(cx + R * math.cos(a1)), round(cy + R * math.sin(a1)), True))
    pts += [(ADV, DESC - EXT, True)]
    return pts


def variant(mirror_x, mirror_y):
    pts = top_left()
    if mirror_x:
        pts = [(round((ADV - x) * (ADV + EXT_X) / ADV), y, on) for x, y, on in pts]
    if mirror_y:
        pts = [(x, MID_Y - y, on) for x, y, on in pts]
    if mirror_x != mirror_y:  # one mirror flips the winding: reverse to stay clockwise
        pts.reverse()
    return pts


def glyph_bytes(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    out = struct.pack('>hhhhh', 1, min(xs), min(ys), max(xs), max(ys))
    out += struct.pack('>H', len(pts) - 1) + struct.pack('>H', 0)
    out += bytes(1 if on else 0 for _, _, on in pts)
    px = py = 0
    for x, _, _ in pts:
        out += struct.pack('>h', x - px); px = x
    for _, y, _ in pts:
        out += struct.pack('>h', y - py); py = y
    return out + b'\0' * (-len(out) % 4)


def checksum(data):
    data += b'\0' * (-len(data) % 4)
    return sum(struct.unpack('>%dI' % (len(data) // 4), data)) & 0xFFFFFFFF


def build(family='Claude Corners'):
    ps = family.replace(' ', '')
    shapes = [variant(False, False), variant(True, False), variant(False, True), variant(True, True)]
    glyphs = [b''] + [glyph_bytes(s) for s in shapes]  # .notdef is empty
    n = len(glyphs)
    glyf = b''.join(glyphs)
    offs, o = [], 0
    for g in glyphs:
        offs.append(o); o += len(g)
    offs.append(o)
    loca = struct.pack('>%dI' % len(offs), *offs)

    head = struct.pack('>IIIIHHqqhhhhHHhhh', 0x00010000, 0x00010000, 0, 0x5F0F3CF5, 3, UPM,
                       3800000000, 3800000000, 0, DESC - EXT, ADV, ASC + EXT, 0, 8, 2, 1, 0)
    hhea = (struct.pack('>Ihhh', 0x00010000, ASC, DESC, 0) + struct.pack('>H', ADV)
            + struct.pack('>hhhhhh', 0, 0, ADV, 1, 0, 0) + struct.pack('>hhhhh', 0, 0, 0, 0, 0)
            + struct.pack('>H', n))
    max_pts = max(len(s) for s in shapes)
    maxp = struct.pack('>IHHHHHHHHHHHHHH', 0x00010000, n, max_pts, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)
    hmtx = b''.join(struct.pack('>Hh', ADV, 0) for _ in range(n))

    seg = struct.pack('>HHHH', 2 * 2, 4, 1, 0)
    cmap4 = struct.pack('>HHH', 4, 0, 0) + seg  # length patched below
    cmap4 += struct.pack('>HH', 0xE9F3, 0xFFFF) + struct.pack('>H', 0)
    cmap4 += struct.pack('>HH', 0xE9F0, 0xFFFF)
    cmap4 += struct.pack('>HH', (1 - 0xE9F0) & 0xFFFF, 1)
    cmap4 += struct.pack('>HH', 0, 0)
    cmap4 = cmap4[:2] + struct.pack('>H', len(cmap4)) + cmap4[4:]
    cmap = struct.pack('>HHHHI', 0, 1, 3, 1, 12) + cmap4

    names = {1: family, 2: 'Regular', 3: ps + '-Regular-1.0', 4: family,
             5: 'Version 1.0', 6: ps + '-Regular'}
    strs, recs, off = b'', b'', 0
    for nid in sorted(names):
        s = names[nid].encode('utf-16-be')
        recs += struct.pack('>HHHHHH', 3, 1, 0x409, nid, len(s), off)
        strs += s; off += len(s)
    name = struct.pack('>HHH', 0, len(names), 6 + 12 * len(names)) + recs + strs

    panose = bytes([2, 11, 6, 9, 0, 0, 0, 0, 0, 0])  # monospaced
    os2 = struct.pack('>HhHHHhhhhhhhhhhh', 3, ADV, 400, 5, 0, 1434, 1331, 0, 287, 1434, 1331, 0, 977, 102, 530, 0)
    os2 += panose + struct.pack('>IIII', 0, 1 << 28, 0, 0) + b'CLDE'
    os2 += struct.pack('>HHHhhhHHIIhhHHH', 0x40, 0xE9F0, 0xE9F3, ASC, DESC, 0, ASC, -DESC, 1, 0, 1000, 1400, 0, 32, 1)
    post = struct.pack('>IIhhIIIII', 0x00030000, 0, -200, 100, 1, 0, 0, 0, 0)

    tables = {b'OS/2': os2, b'cmap': cmap, b'glyf': glyf, b'head': head, b'hhea': hhea,
              b'hmtx': hmtx, b'loca': loca, b'maxp': maxp, b'name': name, b'post': post}
    for tag, size in ((b'head', 54), (b'hhea', 36), (b'maxp', 32), (b'OS/2', 96), (b'post', 32), (b'cmap', 12 + 32)):
        assert len(tables[tag]) == size, (tag, len(tables[tag]))
    tags = sorted(tables)
    num = len(tags)
    sr = 16 * 2 ** int(math.log2(num))
    out = struct.pack('>IHHHH', 0x00010000, num, sr, int(math.log2(num)), num * 16 - sr)
    pos = 12 + 16 * num
    body = b''
    for t in tags:
        d = tables[t]
        out += struct.pack('>4sIII', t, checksum(d), pos + len(body), len(d))
        body += d + b'\0' * (-len(d) % 4)
    font = bytearray(out + body)
    head_off = pos + sum(len(tables[t]) + (-len(tables[t]) % 4) for t in tags if t < b'head')
    struct.pack_into('>I', font, head_off + 8, (0xB1B0AFBA - checksum(bytes(font))) & 0xFFFFFFFF)
    return bytes(font)


if __name__ == '__main__':
    data = build(*sys.argv[2:3])  # optional family name as the second argument
    with open(sys.argv[1], 'wb') as f:
        f.write(data)
    print(len(data), 'bytes ->', sys.argv[1])
