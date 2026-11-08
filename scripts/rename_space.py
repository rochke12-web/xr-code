#!/usr/bin/env python3
"""Rename brand: XR CODE / XR Code -> XR-Space (idempotent, count-checked)."""
import re, pathlib, shutil

P = pathlib.Path('/home/z/my-project/download/xr-code.html')
src = P.read_text(encoding='utf-8')

# snapshot (pre-transform) once
snap = pathlib.Path('/home/z/my-project/scripts/xr-pre-space.html')
if not snap.exists():
    shutil.copyfile(P, snap)

n_upper = src.count('XR CODE')
n_mixed = src.count('XR Code')
assert n_upper + n_mixed > 0, 'nothing to rename (already done?)'
out = src.replace('XR CODE', 'XR-Space').replace('XR Code', 'XR-Space')

# sanity
assert out.count('XR CODE') == 0, 'XR CODE residue'
assert out.count('XR Code') == 0, 'XR Code residue'
assert out.count('XR-Space') == n_upper + n_mixed, 'count mismatch'
# LSKEY stays (internal storage key, invisible; renaming would wipe saved chats)
assert out.count("'xrcode.v1'") == 1, 'LSKEY must remain untouched'
# node --check the extracted app script
m = re.search(r'<script>(.*)</script>', out, re.S)
assert m, 'app script not found'
pathlib.Path('/tmp/_space_check.js').write_text(m.group(1), encoding='utf-8')

P.write_text(out, encoding='utf-8')
print(f'renamed: {n_upper} upper + {n_mixed} mixed = {n_upper + n_mixed} -> XR-Space')
