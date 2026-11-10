#!/usr/bin/env python3
"""Add all free GLM models to the XR-Code model picker (v2, newline-anchored)."""
import sys, shutil

SRC = 'download/xr-code.html'
shutil.copy(SRC, 'scripts/xr-pre-glm.html')
src = open(SRC, encoding='utf-8').read()

def buttons(ind):
    p = ' ' * ind
    return (
      f'\n{p}<div class="mm-sep">Free GLMs</div>\n'
      f'{p}<button type="button" data-m="glm-4.5-flash"><b>GLM 4.5 Flash</b><small>glm-4.5-flash · free &amp; speedy</small></button>\n'
      f'{p}<button type="button" data-m="glm-4-flash"><b>GLM 4 Flash</b><small>glm-4-flash · free classic</small></button>\n'
      f'{p}<button type="button" data-m="glm-4-32b-flash"><b>GLM 32B Flash</b><small>glm-4-32b-flash · free, bigger brain</small></button>\n'
      f'{p}<button type="button" data-m="glm-4.5v"><b>GLM 4.5 Vision</b><small>glm-4.5v · free, sees images natively</small></button>'
    )

home_anchor = '\n              <button type="button" data-m="prime-v1-vision"><b>Vision</b><small>prime-v1-vision · heavier, sharper tasks</small></button>'
chat_anchor = '\n            <button type="button" data-m="prime-v1-vision"><b>Vision</b><small>prime-v1-vision · heavier, sharper tasks</small></button>'

assert src.count(home_anchor) == 1, f'home anchor {src.count(home_anchor)}'
assert src.count(chat_anchor) == 1, f'chat anchor {src.count(chat_anchor)}'

# insert AFTER the vision button in each menu (keep the anchor itself)
src = src.replace(home_anchor, home_anchor + buttons(14))
src = src.replace(chat_anchor, chat_anchor + buttons(12))

old_map = "const MODELS = { 'prime-v1-flash': 'Flash', 'prime-v1-vision': 'Vision' };"
new_map = ("const MODELS = { 'prime-v1-flash': 'Flash', 'prime-v1-vision': 'Vision', "
           "'glm-4.5-flash': 'GLM Flash', 'glm-4-flash': 'GLM 4', "
           "'glm-4-32b-flash': 'GLM 32B', 'glm-4.5v': 'GLM Vision' };")
assert src.count(old_map) == 1
src = src.replace(old_map, new_map)

old_css = '.mmenu{'
assert src.count(old_css) == 1
src = src.replace(old_css,
  '.mm-sep{margin:6px 10px 2px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);opacity:.75}\n.mmenu{')

open(SRC, 'w', encoding='utf-8').write(src)

v = open(SRC, encoding='utf-8').read()
h = v[v.find('id="homeModelMenu"'):v.find('id="homeModelMenu"') + 1400]
c = v[v.find('id="chatModelMenu"'):v.find('id="chatModelMenu"') + 1400]
checks = {
  '6-entry MODELS map': v.count("'glm-4.5-flash': 'GLM Flash'") == 1,
  'home menu: 4 GLM buttons': h.count('data-m="glm-') == 4,
  'chat menu: 4 GLM buttons': c.count('data-m="glm-') == 4,
  '2 group labels': v.count('<div class="mm-sep">Free GLMs</div>') == 2,
  'mm-sep css': v.count('.mm-sep{') == 1,
}
for k, good in checks.items(): print(('PASS ' if good else 'FAIL ') + k)
if not all(checks.values()): sys.exit('VERIFY FAILED')
print('OK — client GLM models added')
