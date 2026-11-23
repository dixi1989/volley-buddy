#!/usr/bin/env python3
"""Renders tools/logo_pixel.html (pixel-art title on a 160x62 grid) to icons/logo.png at 4x with a transparent background.
Needs playwright + a Chrome/Chromium. Usage: python3 tools/make_logo_pixel.py [chrome-path]"""
import os, sys
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__))
exe = sys.argv[1] if len(sys.argv) > 1 else None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 640, 'height': 248}, device_scale_factor=1)
    pg.goto('file://' + os.path.join(here, 'logo_pixel.html'))
    pg.wait_for_selector('body[data-ready="1"]')
    pg.locator('canvas').screenshot(path=os.path.join(here, '..', 'icons', 'logo.png'), omit_background=True)
    b.close()
