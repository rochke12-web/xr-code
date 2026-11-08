"""Mobile topbar fix (applied directly to the current build):
at <=980px hide 'Made by YUX FF' + version badge so the center title no longer overlaps.
"""
OUT = '/home/z/my-project/download/xr-code.html'
html = open(OUT).read()

old = '''  .topbar{grid-template-columns:auto 1fr auto}
  .title-center h1{font-size:16px;letter-spacing:.28em}'''
new = '''  .topbar{grid-template-columns:auto 1fr auto}
  .title-center h1{font-size:16px;letter-spacing:.28em}
  .brand .made{display:none}
  .version-badge{display:none}'''

assert html.count(old) == 1, 'topbar media query anchor not found'
open(OUT, 'w').write(html.replace(old, new))
print('mobile topbar fix applied')
