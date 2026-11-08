"""Move the workspace sidebar from the right side to the left side."""
import os

OUT = '/home/z/my-project/download/xr-code.html'
html = open(OUT).read()

def n1(needle):
    assert html.count(needle) == 1, 'anchor not unique (%d): %r' % (html.count(needle), needle[:60])
    return needle

# 1. sidebar: left border -> right border, and place it first (left) in the flex row
old = '''  width:302px;flex:none;display:flex;flex-direction:column;min-height:0;
  border-left:1px solid var(--line);background:var(--panel);backdrop-filter:blur(14px);'''
new = '''  width:302px;flex:none;display:flex;flex-direction:column;min-height:0;order:-1;
  border-right:1px solid var(--line);background:var(--panel);backdrop-filter:blur(14px);'''
html = html.replace(n1(old), new)

# 2. mobile layout: sidebar stays BELOW main, border on top
old = '.sidebar{width:100%;border-left:none;border-top:1px solid var(--line);max-height:46vh}'
new = '.sidebar{width:100%;border-right:none;border-top:1px solid var(--line);max-height:46vh;order:2}'
html = html.replace(n1(old), new)

# 3. toasts move to the bottom-right so they don't cover the sidebar
old = '.toasts{position:fixed;left:18px;bottom:52px;'
new = '.toasts{position:fixed;right:18px;bottom:52px;'
html = html.replace(n1(old), new)

open(OUT, 'w').write(html)
print('sidebar moved to left, size:', os.path.getsize(OUT)//1024, 'KB')
