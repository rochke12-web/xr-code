#!/usr/bin/env python3
# Can the Prime gateway's vision model actually SEE an image?
# Reads PRIME_BASE_URL / PRIME_API_KEY from .env.local (never printed).
import base64, io, json, os, urllib.request

env = {}
for line in open('.env.local'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k] = v
BASE, KEY = env['PRIME_BASE_URL'].rstrip('/'), env['PRIME_API_KEY']

# make a distinctive test image
from PIL import Image, ImageDraw
img = Image.new('RGB', (320, 240), (200, 30, 30))
d = ImageDraw.Draw(img)
d.ellipse([110, 70, 210, 170], fill=(30, 60, 200))
buf = io.BytesIO()
img.save(buf, format='PNG')
b64 = base64.b64encode(buf.getvalue()).decode()
dataurl = 'data:image/png;base64,' + b64

def call(model, content, tag):
    body = json.dumps({
        "model": model,
        "max_tokens": 300,
        "messages": [{"role": "user", "content": content}],
    }).encode()
    req = urllib.request.Request(BASE + '/v1/messages', data=body, headers={
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            d = json.loads(r.read())
        txt = ''.join(b.get('text', '') for b in d.get('content', []) if isinstance(b, dict))
        print(f'[{tag}] 200  -> {txt.strip()[:220] or d}')
    except urllib.error.HTTPError as e:
        print(f'[{tag}] HTTP {e.code} -> {e.read().decode()[:220]}')
    except Exception as e:
        print(f'[{tag}] ERR -> {repr(e)[:160]}')

# OpenAI-style image_url part (what the app client sends)
call('prime-v1-vision',
     [{"type": "text", "text": "What do you see? Name colors and any text. Be brief."},
      {"type": "image_url", "image_url": {"url": dataurl}}],
     'openai-style')

# Anthropic-style image block
call('prime-v1-vision',
     [{"type": "text", "text": "What do you see? Name colors and any text. Be brief."},
      {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}}],
     'anthropic-style')
