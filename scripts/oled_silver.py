"""OLED black + silver retheme:
- dark theme -> pure #000 + silver accents (OLED style)
- hero backdrops -> the user's Ionic column scene images (dark + light)
Transforms from a pristine pre-oled snapshot so it can be re-run safely."""
import base64, io, os, shutil
from PIL import Image

DL   = '/home/z/my-project/download'
UP   = '/home/z/my-project/upload'
SNAP = '/home/z/my-project/scripts/xr-pre-oled.html'
OUT  = f'{DL}/xr-code.html'

if not os.path.exists(SNAP):
    shutil.copy(OUT, SNAP)
html = open(SNAP).read()

def n1(needle):
    assert html.count(needle) == 1, 'anchor not unique (%d): %r' % (html.count(needle), needle[:60])
    return needle

# ---------- 1. scene images -> optimized jpeg base64 ----------
def scene_b64(src, quality=78):
    im = Image.open(src).convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
    return base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())//1024

dark_scene, k1 = scene_b64(f'{UP}/pasted_image_1794115478687.png')
light_scene, k2 = scene_b64(f'{UP}/pasted_image_1794115500565.png')
print('scene jpeg sizes:', k1, 'KB +', k2, 'KB')

hero_old = n1('''        <div class="column l"></div>
        <div class="column r"></div>
        <div class="clouds"></div>''')
hero_new = ('<img class="scene dark-only" src="data:image/jpeg;base64,' + dark_scene + '" alt="">\n'
            '        <img class="scene light-only" src="data:image/jpeg;base64,' + light_scene + '" alt="">')
html = html.replace(hero_old, hero_new)

# ---------- 2. scene CSS (theme switching + layering) ----------
css_anchor = n1('/* ---------- logo images + quick theme toggle ---------- */')
scene_css = '''/* ---------- hero scene backdrops (ionic columns) ---------- */
.scene{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:center bottom;
  pointer-events:none;z-index:0;user-select:none;
}
.scene.light-only{display:none}
:root[data-theme="light"] .scene.dark-only{display:none}
:root[data-theme="light"] .scene.light-only{display:block}
.hero > *:not(.scene){z-index:1}

'''
html = html.replace(css_anchor, scene_css + css_anchor)

# ---------- 3. OLED dark palette ----------
pairs = [
    # background: pure black + faint silver glow (OLED)
    ('radial-gradient(1100px 480px at 50% -12%, rgba(124,104,214,.16), transparent 62%),',
     'radial-gradient(1100px 480px at 50% -12%, rgba(216,219,228,.07), transparent 62%),'),
    ('radial-gradient(560px 300px at 6% 104%, rgba(124,104,214,.08), transparent 60%),',
     'radial-gradient(560px 300px at 6% 104%, rgba(216,219,228,.035), transparent 60%),'),
    ('    #0b0b0f;\n', '    #000000;\n'),
    ('--bg:#0b0b0f;', '--bg:#000000;'),
    ('--bg2:#121218;', '--bg2:#0b0b0e;'),
    ('--text:#f1eee7;', '--text:#f4f5f7;'),
    ('--muted:#9a95a8;', '--muted:#8e9099;'),
    # silver accents
    ('--accent:#b9a7ff;', '--accent:#dfe3ea;'),
    ('--accent-2:#e6d9b8;', '--accent-2:#a7adb9;'),
    ('--accent-ink:#17122b;', '--accent-ink:#0e1013;'),
]
for old, new in pairs:
    html = html.replace(n1(old), new)

# ---------- 4. metallic silver gradient headline ----------
thin_old = n1('.hero h2 .thin{color:var(--accent)}')
thin_new = ('.hero h2 .thin{background:linear-gradient(160deg,#ffffff 8%,#c9ccd5 46%,#8f939e 82%);'
            '-webkit-background-clip:text;background-clip:text;color:transparent}')
html = html.replace(thin_old, thin_new)

# ---------- 5. silver polish details (dark only via vars is enough) ----------
# AI chip + hero pill dot glow already use vars; make user bubble text crisp on silver
bubble_old = n1('.msg.u .bubble{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-ink);border-bottom-right-radius:4px}')
bubble_new = bubble_old.replace('linear-gradient(135deg,var(--accent),var(--accent-2))',
                                'linear-gradient(135deg,#f0f2f6,#b6bbc6)')
html = html.replace(bubble_old, bubble_new)

open(OUT, 'w').write(html)
print('OLED retheme OK, new size:', os.path.getsize(OUT)//1024, 'KB')
