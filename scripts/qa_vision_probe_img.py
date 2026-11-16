#!/usr/bin/env python3
"""Build a distinctive test image for vision E2E: big text 'XR-7', red circle, blue bar."""
from PIL import Image, ImageDraw, ImageFont
W, H = 640, 400
im = Image.new("RGB", (W, H), "#f5f0e6")
d = ImageDraw.Draw(im)
d.ellipse([40, 60, 240, 260], fill="#d93025", outline="#7a1108", width=6)  # red circle
d.rectangle([300, 250, 600, 320], fill="#1a73e8")  # blue bar
try:
    f_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 96)
    f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
except Exception:
    f_big = f_sm = ImageFont.load_default()
d.text((260, 80), "XR-7", font=f_big, fill="#202124")
d.text((60, 330), "vision checkpoint alpha", font=f_sm, fill="#5f6368")
im.save("/tmp/vetest/vision_probe.png")
print("saved /tmp/vetest/vision_probe.png", im.size)
