#!/usr/bin/env python3
"""XR CODE — attach button on the HOME search bar too:
- paperclip to the right of the home send (chevron) button
- one shared attachment state: chips render in BOTH the home form and the chat composer
- sending from home carries the files into the new chat automatically"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-homeattach.html'

src = open(SRC, encoding='utf-8').read()
if 'homeFileBtn' in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. markup: paperclip right of the home send button ----
src = rep(src,
"""<button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-chev"></i></button>
        </form>""",
"""<button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-chev"></i></button>
          <button class="file-btn" id="homeFileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>
        </form>""")

# ---- 2. home pill: let the attach row wrap above the input ----
src = rep(src,
"""width:min(660px,100%);display:flex;align-items:center;gap:10px;""",
"""width:min(660px,100%);display:flex;flex-wrap:wrap;align-items:center;gap:10px;""")

# ---- 3. shared engine: one picker + one state, rows in both forms ----
src = rep(src,
"""  const form = $('#chatForm');
  const pick = document.createElement('input');
  pick.type = 'file'; pick.multiple = true; pick.hidden = true;
  form.appendChild(pick);
  const row = document.createElement('div');
  row.className = 'attach-row';
  form.prepend(row);""",
"""  const forms = [$('#chatForm'), $('#homeForm')];
  const pick = document.createElement('input');
  pick.type = 'file'; pick.multiple = true; pick.hidden = true;
  forms[0].appendChild(pick);
  const rows = forms.map(f => {
    const r = document.createElement('div');
    r.className = 'attach-row';
    f.prepend(r);
    return r;
  });""")

# ---- 4. draw(): render chips into every row ----
src = rep(src,
"""  function draw(){
    row.innerHTML = '';
    ATT.forEach((a, i) => {
      const chip = document.createElement('span'); chip.className = 'att-chip';
      if(a.d){
        const im = document.createElement('img'); im.src = a.d; im.alt = a.n; chip.append(im);
      }else{
        const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ic.setAttribute('class', 'ic small'); ic.innerHTML = '<use href="#i-file"/>';
        chip.append(ic);
      }
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.n; nm.title = a.n;
      const sz = document.createElement('span'); sz.className = 'sz'; sz.textContent = window.fmtSz(a.sz);
      const rm = document.createElement('button'); rm.className = 'rm'; rm.type = 'button'; rm.title = 'Remove'; rm.textContent = '\\u00d7';
      rm.onclick = () => { ATT.splice(i, 1); draw(); };
      chip.append(nm, sz, rm);
      row.append(chip);
    });
  }""",
"""  function draw(){
    rows.forEach(row => {
      row.innerHTML = '';
      ATT.forEach((a, i) => {
        const chip = document.createElement('span'); chip.className = 'att-chip';
        if(a.d){
          const im = document.createElement('img'); im.src = a.d; im.alt = a.n; chip.append(im);
        }else{
          const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          ic.setAttribute('class', 'ic small'); ic.innerHTML = '<use href="#i-file"/>';
          chip.append(ic);
        }
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.n; nm.title = a.n;
        const sz = document.createElement('span'); sz.className = 'sz'; sz.textContent = window.fmtSz(a.sz);
        const rm = document.createElement('button'); rm.className = 'rm'; rm.type = 'button'; rm.title = 'Remove'; rm.textContent = '\\u00d7';
        rm.onclick = () => { ATT.splice(i, 1); draw(); };
        chip.append(nm, sz, rm);
        row.append(chip);
      });
    });
  }""")

# ---- 5. wire the home paperclip to the same picker ----
src = rep(src,
"""  $('#fileBtn').onclick = () => pick.click();""",
"""  $('#fileBtn').onclick = () => pick.click();
  $('#homeFileBtn').onclick = () => pick.click();""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('homeFileBtn') == 2, core.count('homeFileBtn')
assert core.count('i-clip') == 3, core.count('i-clip')          # symbol + 2 markup hooks
assert core.count('attach-row') == 3                            # 2 css + 1 js class
assert core.count('rows.forEach') == 1 and core.count('forms.map') == 1
assert core.count("$('#fileBtn').onclick") == 1 and core.count("$('#homeFileBtn').onclick") == 1
assert core.count("row.innerHTML = ''") == 1                    # single shared draw loop
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — paperclip on home search bar, shared attach state across forms')
