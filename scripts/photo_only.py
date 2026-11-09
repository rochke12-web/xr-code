#!/usr/bin/env python3
# photo_only.py — allow sending a photo with no text (XR Code then explains it).
import re, shutil

SRC = '/home/z/my-project/download/xr-code.html'
shutil.copyfile(SRC, '/home/z/my-project/scripts/xr-pre-photoonly.html')

src = open(SRC, encoding='utf-8').read()

old = """function sendMsg(text){
  text = (text || '').trim(); if(!text) return;
  const c = currentChat();
  if(c.title === 'New Project') c.title = text.slice(0, 34) + (text.length > 34 ? '...' : '');
  const live = window.__takeAtts ? window.__takeAtts() : [];"""
new = """function sendMsg(text){
  text = (text || '').trim();
  const live = window.__takeAtts ? window.__takeAtts() : [];
  if(!text && !live.length) return;                // nothing to send — but a bare photo is fine
  const c = currentChat();
  const base = text || (live[0] ? live[0].n : 'Photo');
  if(c.title === 'New Project') c.title = base.slice(0, 34) + (base.length > 34 ? '...' : '');"""

assert src.count(old) == 1, 'sendMsg anchor not found'
out = src.replace(old, new)

assert out.count('a bare photo is fine') == 1
assert out.count("if(!text) return;") == 0
open(SRC, 'w', encoding='utf-8').write(out)

m = re.search(r'<script>(.*)</script>', out, re.S)
open('/tmp/xr_photoonly_check.js', 'w', encoding='utf-8').write(m.group(1))
print('OK — photo-only sends enabled')
