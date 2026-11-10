#!/usr/bin/env python3
"""XR-Code 'strict black & white' pass — strip the cool blue cast from every
gray in the single-file UI. Each blue-tinted value maps to its pure neutral
equivalent; cool white alphas become pure white alphas."""
import re, sys

PATH = "/home/z/my-project/download/xr-code.html"

HEX = {
    # dark theme tokens
    "#f4f5f7": "#fafafa",  # --text, --danger
    "#8e9099": "#8f8f8f",  # --muted
    "#dfe3ea": "#eaeaea",  # --accent
    "#a7adb9": "#a3a3a3",  # --accent-2
    "#0e1013": "#0a0a0a",  # --accent-ink
    "#101218": "#101010",  # --pop
    "#0b0b0e": "#0b0b0b",  # --bg2
    "#e6e8ee": "#e5e5e5",  # --ok
    "#c9ccd5": "#c6c6c6",  # hero shimmer mid
    "#f0f2f6": "#f5f5f5",  # user bubble start
    "#b6bbc6": "#b0b0b0",  # user bubble end
    "#f4f6f8": "#f5f5f5",
    "#f7f7f8": "#f5f5f5",  # light --bg
    "#f2f2f4": "#f0f0f0",  # light marble end
    "#0b0b0d": "#0a0a0a",  # light --text
    "#6d7076": "#6e6e6e",  # light --muted
    "#101216": "#101010",  # light --accent
    "#3f434b": "#3d3d3d",
    "#1a1c20": "#181818",
    "#3c4046": "#3a3a3a",
    "#85898f": "#8a8a8a",
    "#3a3d43": "#383838",
    "#3a3e46": "#3a3a3a",
}
SUB = [
    ("rgba(216,219,228,", "rgba(255,255,255,"),   # cool white alphas -> pure
    ("rgba(240,242,246,", "rgba(255,255,255,"),
    ("rgba(247,247,248,.72)", "rgba(250,250,250,.8)"),
    ("lavender marble + greek columns", "white marble + greek columns"),
    ("(black marble + clouds)", "(pure black + white light)"),
]

src = open(PATH, encoding="utf-8").read()
hits = 0
for old, new in HEX.items():
    n = src.count(old)
    if n:
        hits += n
        src = src.replace(old, new)
for old, new in SUB:
    n = src.count(old)
    if n:
        hits += n
        src = src.replace(old, new)
open(PATH, "w", encoding="utf-8").write(src)
print(f"replaced {hits} color references")

# verify nothing cool-tinted remains
left = re.findall(r"#(?:[0-9a-f]{2})(?:[0-9a-f]{2})([0-9a-f]{2})\b", src)
cool = [
    c for c in re.findall(r"#[0-9a-fA-F]{6}\b", src)
    if abs(int(c[1:3], 16) - int(c[5:7], 16)) > 6 or abs(int(c[3:5], 16) - int(c[5:7], 16)) > 6
]
print("chromatic leftovers:", sorted(set(cool)) if cool else "NONE — palette is pure neutral")
