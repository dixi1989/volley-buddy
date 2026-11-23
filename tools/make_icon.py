#!/usr/bin/env python3
"""Generates the app icons (pixel art on a 32x32 grid): icons/icon.svg, icon-192/512.png, icon-maskable-512.png.
Usage: python3 tools/make_icon.py <icons dir>"""
import math, sys, os
from PIL import Image

N = 32
g = [[None] * N for _ in range(N)]
def px(x, y, c):
    if 0 <= x < N and 0 <= y < N: g[y][x] = c
def rect(x, y, w, h, c):
    for j in range(h):
        for i in range(w): px(x + i, y + j, c)
def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# background: sunset gradient + sunburst rays
top, bot = hexrgb('#2b1068'), hexrgb('#ee1a8c')
for y in range(N):
    for x in range(N):
        base = mix(top, bot, y / (N - 1))
        a = math.atan2(y - 17, x - 16)
        ray = int((a + math.pi) / (2 * math.pi) * 20) % 2
        px(x, y, mix(base, (255, 214, 90), 0.16) if ray else base)
# sun disc
for y in range(N):
    for x in range(N):
        d = math.hypot(x - 16 + 0.5, y - 17 + 0.5)
        if d < 11.5: px(x, y, hexrgb('#ff8a2b') if d > 9.5 else mix(hexrgb('#ffd23f'), hexrgb('#ff9a3c'), d / 10))
# sand strip
rect(0, 28, N, 4, hexrgb('#f6c48f')); rect(0, 28, N, 1, hexrgb('#ee8f6a'))

OUT, HOOD, HOOD2, SK = hexrgb('#1a0f33'), hexrgb('#232b4a'), hexrgb('#151a30'), hexrgb('#d99a63')
TEAL, TEAL2 = hexrgb('#2fd9c8'), hexrgb('#16897f')
# ninja head with outline
rect(8, 8, 16, 17, OUT)
rect(9, 9, 14, 15, HOOD); rect(9, 9, 2, 15, HOOD); rect(21, 9, 2, 15, HOOD2); rect(9, 22, 14, 2, HOOD2)
rect(10, 15, 12, 5, SK); rect(10, 19, 12, 1, hexrgb('#b57545'))
# eyes + fierce brows
rect(11, 16, 3, 2, (255, 255, 255)); rect(18, 16, 3, 2, (255, 255, 255)); rect(13, 16, 1, 2, OUT); rect(18, 16, 1, 2, OUT)
rect(10, 15, 4, 1, OUT); rect(18, 15, 4, 1, OUT); rect(13, 14, 2, 1, OUT); rect(17, 14, 2, 1, OUT)
# headband with tails
rect(8, 11, 16, 3, OUT); rect(9, 11, 14, 2, TEAL); rect(9, 13, 14, 1, TEAL2)
rect(14, 11, 4, 2, hexrgb('#d8dde8')); rect(15, 12, 2, 1, hexrgb('#8a93a6'))
rect(24, 10, 4, 3, OUT); rect(24, 11, 3, 1, TEAL); rect(26, 13, 4, 3, OUT); rect(26, 14, 3, 1, TEAL2)
# katana behind-right (diagonal)
for i in range(12):
    px(21 + i // 2 + 0, 25 - i, hexrgb('#e8eef6')); px(22 + i // 2, 25 - i, hexrgb('#aab6c8'))
# ball bottom-left
for y in range(N):
    for x in range(N):
        d = math.hypot(x - 5.5, y - 25.5)
        if d < 4.2: px(x, y, OUT)
        if d < 3.2: px(x, y, (255, 255, 255) if (x + y) % 5 else hexrgb('#ff7ac8'))
rect(3, 25, 6, 1, hexrgb('#2fd9c8'))

def hexs(c): return '#%02x%02x%02x' % c
out = sys.argv[1] if len(sys.argv) > 1 else 'icons'
# PNGs
img = Image.new('RGB', (N, N))
for y in range(N):
    for x in range(N): img.putpixel((x, y), g[y][x])
for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('icon-maskable-512.png', 512)):
    img.resize((size, size), Image.NEAREST).save(os.path.join(out, name))
# SVG: one rect per horizontal run of equal colour
rects = []
for y in range(N):
    x = 0
    while x < N:
        c = g[y][x]; w = 1
        while x + w < N and g[y][x + w] == c: w += 1
        rects.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>' % (x, y, w, hexs(c))); x += w
open(os.path.join(out, 'icon.svg'), 'w').write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">' + ''.join(rects) + '</svg>\n')
