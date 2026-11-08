"""Prepare XR logos (remove solid backgrounds, square them) and embed
them into xr-code.html with automatic dark/light switching."""
import base64, os, shutil
from PIL import Image
from collections import deque

UP  = '/home/z/my-project/upload'
DL  = '/home/z/my-project/download'
AS  = DL + '/assets'
TMP = '/home/z/my-project/scripts/xr-template.html'
os.makedirs(AS, exist_ok=True)

def transparentize(src, dst, tol=60):
    """Flood-fill the solid background from the borders -> alpha 0, then
    trim and pad to a centered square."""
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    bg = px[0, 0][:3]
    near = lambda p: abs(p[0]-bg[0]) + abs(p[1]-bg[1]) + abs(p[2]-bg[2]) < tol
    seen = [[False]*w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if near(px[x, y]) and not seen[y][x]: q.append((x, y)); seen[y][x] = True
    for y in range(h):
        for x in (0, w-1):
            if near(px[x, y]) and not seen[y][x]: q.append((x, y)); seen[y][x] = True
    while q:
        x, y = q.popleft()
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and near(px[nx, ny]):
                seen[ny][nx] = True
                q.append((nx, ny))
    im = im.crop(im.getbbox())
    w, h = im.size
    side = max(w, h)
    pad = int(side * 0.08)
    canvas = Image.new('RGBA', (side + pad*2, side + pad*2), (0, 0, 0, 0))
    canvas.paste(im, (pad + (side-w)//2, pad + (side-h)//2))
    canvas.save(dst)
    print('saved', dst, canvas.size, os.path.getsize(dst)//1024, 'KB')

transparentize(f'{UP}/pasted_image_1794115125864.png', f'{AS}/xr-logo-dark.png')
transparentize(f'{UP}/pasted_image_1794115141245.png', f'{AS}/xr-logo-light.png')

# ---- embed into the HTML (always starts from the pristine template) ----
if not os.path.exists(TMP):
    shutil.copy(f'{DL}/xr-code.html', TMP)

html = open(TMP).read()

dark_b64  = base64.b64encode(open(f'{AS}/xr-logo-dark.png',  'rb').read()).decode()
light_b64 = base64.b64encode(open(f'{AS}/xr-logo-light.png', 'rb').read()).decode()

# 1. both topbar logo tiles get the theme-switching images
logo_old = '<div class="logo">XR</div>'
assert html.count(logo_old) == 2, 'logo tiles: %d' % html.count(logo_old)
logo_new = ('<div class="logo">'
            '<img class="logo-img dark-only" src="data:image/png;base64,' + dark_b64  + '" alt="XR logo dark">'
            '<img class="logo-img light-only" src="data:image/png;base64,' + light_b64 + '" alt="XR logo light">'
            '</div>')
html = html.replace(logo_old, logo_new)

# 2. favicon (colored version reads well on both tab colors)
title = '<title>XR CODE — by YUX FF</title>'
assert html.count(title) == 1
html = html.replace(title, title +
    '\n<link rel="icon" type="image/png" href="data:image/png;base64,' + light_b64 + '">')

# 3. quick light/dark toggle button in the top bar (right side)
badge = '<span class="version-badge">Version <b>1.0.0</b></span>'
assert html.count(badge) == 1
html = html.replace(badge, badge + '''
    <button class="theme-quick" id="themeQuick" type="button" title="Toggle light / dark mode">
      <svg class="ic ic-sun"><use href="#i-sun"/></svg>
      <svg class="ic ic-moon"><use href="#i-moon"/></svg>
    </button>''')

# 4. CSS for logo images + toggle button
css_anchor = '/* ---------- scrollbars ---------- */'
assert html.count(css_anchor) == 1
css = '''/* ---------- logo images + quick theme toggle ---------- */
.logo{padding:3px;background:var(--bg2)}
.logo .logo-img{width:100%;height:100%;object-fit:contain;display:block}
.logo .light-only{display:none}
:root[data-theme="light"] .logo .dark-only{display:none}
:root[data-theme="light"] .logo .light-only{display:block}
.theme-quick{
  width:36px;height:36px;border:1px solid var(--line);border-radius:10px;
  display:grid;place-items:center;color:var(--muted);background:var(--panel);
  transition:color .15s,border-color .15s;flex:none;
}
.theme-quick:hover{color:var(--accent);border-color:var(--accent)}
.theme-quick .ic-moon{display:none}
:root[data-theme="light"] .theme-quick .ic-moon{display:block}
:root[data-theme="light"] .theme-quick .ic-sun{display:none}

'''
html = html.replace(css_anchor, css + css_anchor)

# 5. JS wiring for the toggle
js_anchor = "$('#brandTitle').onclick = () => showView('home');"
assert html.count(js_anchor) == 1
html = html.replace(js_anchor, js_anchor +
    "\n$('#themeQuick').onclick = () => setTheme(S.theme === 'dark' ? 'light' : 'dark');")

open(f'{DL}/xr-code.html', 'w').write(html)
print('embedded OK, new size:', os.path.getsize(f'{DL}/xr-code.html')//1024, 'KB')
