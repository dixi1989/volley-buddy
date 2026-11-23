#!/usr/bin/env python3
"""Generates icons/logo.svg ("BEACH VOLLEY HERO") as pure SVG paths (no font needed at runtime).
Needs fontTools and the Russo One + Bungee .woff files (npm: @fontsource/russo-one, @fontsource/bungee).
Usage: make_logo.py russo-one.woff bungee.woff out.svg"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

def text_path(path, text, size, tracking=0):
    f = TTFont(path); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
    k = size / upm; x = 0; ds = []
    for ch in text:
        g = cmap[ord(ch)]; pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
        ds.append(pen.getCommands()); x += gs[g].width * k + tracking
    return ' '.join(ds), x - tracking, f['OS/2'].sCapHeight * k

russo, bungee, out = sys.argv[1:4]
d1, w1, c1 = text_path(russo, 'BEACH VOLLEY', 62, 5)
d2, w2, c2 = text_path(bungee, 'HERO', 150, 6)
W, H = 640, 250
x1 = (W - w1) / 2; x2 = (W - w2) / 2; y1 = 78; y2 = 214

ext = ''.join(f'<use href="#hero" x="{i * 0.9:.1f}" y="{i * 1.0:.1f}" fill="#4a0612"/>' for i in range(14, 0, -1))
rays = ''.join(f'<path d="M320 150 L{320 + 600 * __import__("math").cos(a):.0f} {150 + 600 * __import__("math").sin(a):.0f} L{320 + 600 * __import__("math").cos(a + 0.09):.0f} {150 + 600 * __import__("math").sin(a + 0.09):.0f}Z"/>'
               for a in [i * 0.2618 for i in range(24)])
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
<path id="beach" d="{d1}"/>
<path id="hero" d="{d2}"/>
<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".38" stop-color="#bcd6ff"/><stop offset=".5" stop-color="#4f78c4"/><stop offset=".53" stop-color="#1d3a7a"/><stop offset=".78" stop-color="#7fb0ff"/><stop offset="1" stop-color="#e6f1ff"/></linearGradient>
<linearGradient id="fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a0"/><stop offset=".3" stop-color="#ffd23f"/><stop offset=".58" stop-color="#ff7a1a"/><stop offset=".85" stop-color="#e8222f"/><stop offset="1" stop-color="#9c1024"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe27a" stop-opacity=".85"/><stop offset=".6" stop-color="#ff5aa8" stop-opacity=".25"/><stop offset="1" stop-color="#ff5aa8" stop-opacity="0"/></radialGradient>
<clipPath id="c"><rect width="{W}" height="{H}"/></clipPath>
</defs>
<g clip-path="url(#c)">
<ellipse cx="320" cy="150" rx="300" ry="110" fill="url(#glow)"/>
<g fill="#ffd23f" opacity=".13">{rays}</g>
<g transform="skewX(-9) translate(22 0)">
  <g transform="translate({x1:.1f} {y1})">
    <use href="#beach" x="3" y="4" fill="#0b0a2a"/>
    <use href="#beach" fill="none" stroke="#10163a" stroke-width="9" stroke-linejoin="round"/>
    <use href="#beach" fill="url(#chrome)"/>
    <use href="#beach" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/>
  </g>
  <g transform="translate({x2:.1f} {y2})">
    {ext}
    <use href="#hero" fill="none" stroke="#1a0a1f" stroke-width="16" stroke-linejoin="round"/>
    <use href="#hero" fill="none" stroke="#fff3c4" stroke-width="7" stroke-linejoin="round"/>
    <use href="#hero" fill="none" stroke="#1a0a1f" stroke-width="3" stroke-linejoin="round" transform="translate(0 0)"/>
    <use href="#hero" fill="url(#fire)"/>
  </g>
</g>
<g fill="#fff" opacity=".95">
  <path d="M40 120 l5 -16 l5 16 l16 5 l-16 5 l-5 16 l-5 -16 l-16 -5z" transform="scale(.8) translate(20 40)"/>
  <path d="M590 70 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4z"/>
</g>
</g></svg>'''
open(out, 'w').write(svg)
print('ok', round(w1), round(w2), round(c1), round(c2))
