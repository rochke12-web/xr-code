#!/usr/bin/env python3
# Can the Prime gateway's vision engine (prime-vision) actually SEE an image?
# Distinctive probe: red background + blue circle + white text "XR-7" — a model
# that sees pixels must name red, a circle and XR-7. prime-v1 rides along as a
# control (known: image blocks accepted but unseen). Never prints the key.
import base64, io, json, os, urllib.request

env = {}
if os.path.exists('.env.local'):
    for line in open('.env.local'):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v
if 'PRIME_API_KEY' not in env:
    src = open('src/lib/xrsecrets.ts').read()
    import re
    m = re.search(r'PRIME_API_BASE:\s*"([^"]+)"', src)
    if m:
        env['PRIME_BASE_URL'] = m.group(1)
    m = re.search(r'PRIME_API_KEY:\s*"([^"]+)"', src)
    if m:
        env['PRIME_API_KEY'] = m.group(1)
BASE, KEY = env['PRIME_BASE_URL'].rstrip('/'), env['PRIME_API_KEY']

from PIL import Image, ImageDraw
img = Image.new('RGB', (320, 240), (200, 30, 30))          # red background
d = ImageDraw.Draw(img)
d.ellipse([110, 70, 210, 170], fill=(30, 60, 200))          # blue circle
d.text((130, 110), 'XR-7', fill=(255, 255, 255))            # white text
buf = io.BytesIO()
img.save(buf, format='PNG')
b64 = base64.b64encode(buf.getvalue()).decode()
dataurl = 'data:image/png;base64,' + b64
print('probe image: red background / blue circle / white text "XR-7"')

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
        usage = d.get('usage') or {}
        print(f'[{tag}] 200  usage={usage} -> {txt.strip()[:300] or d}')
        low = txt.lower()
        sees = ('red' in low) or ('xr-7' in low) or ('xr7' in low)
        print(f'[{tag}] verdict: {"SEES PIXELS" if sees else "did not see red/XR-7"}')
        return sees
    except urllib.error.HTTPError as e:
        print(f'[{tag}] HTTP {e.code} -> {e.read().decode()[:220]}')
        return False
    except Exception as e:
        print(f'[{tag}] ERR -> {repr(e)[:160]}')
        return False

q = 'Look at the attached image. What color is the background, what shape is shown, and transcribe any text exactly. Be brief.'

# Anthropic-style image block (what the gateway expects)
anth = [{"type": "text", "text": q},
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}}]
v1 = call('prime-vision', anth, 'prime-vision/anthropic-style')
v2 = call('prime-v1', anth, 'prime-v1/anthropic-style (control)')

# OpenAI-style image_url part (alternate encoding)
oai = [{"type": "text", "text": q},
       {"type": "image_url", "image_url": {"url": dataurl}}]
call('prime-vision', oai, 'prime-vision/openai-style')

print('SUMMARY: prime-vision anthropic-style sees pixels =', v1, '| control prime-v1 =', v2)
