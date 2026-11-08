#!/usr/bin/env python3
"""XR CODE — sidebar tab switch animation:
- gliding pill indicator that slides between sidebar tabs (springy transform)
- icon pop on the newly selected tab
- directional view slide (forward = from right, backward = from left)
- search tab hosts the pill while the search panel is open"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-tabanim.html'

src = open(SRC, encoding='utf-8').read()
if 'nav-glider' in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. nav container: positioning context for the glider ----
src = rep(src,
""".nav{display:flex;flex-direction:column;gap:2px;padding:0 10px}""",
""".nav{display:flex;flex-direction:column;gap:2px;padding:0 10px;position:relative}
.nav-glider{position:absolute;left:10px;right:10px;top:0;border-radius:10px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line);pointer-events:none;z-index:0;opacity:1;will-change:transform}
.nav-glider.off{opacity:0}
.nav-glider.no-anim{transition:none !important}""")

# ---- 2. nav buttons: sit above the glider ----
src = rep(src,
""".nav button{
  display:flex;align-items:center;gap:11px;width:100%;text-align:left;
  padding:9px 11px;border-radius:10px;font-size:13.5px;font-weight:500;color:var(--text);
  transition:background .15s;
}""",
""".nav button{
  display:flex;align-items:center;gap:11px;width:100%;text-align:left;
  padding:9px 11px;border-radius:10px;font-size:13.5px;font-weight:500;color:var(--text);
  position:relative;z-index:1;
  transition:background .15s,color .2s;
}""")

# ---- 3. current state: pill (glider) paints the background, button keeps the accent text ----
src = rep(src,
""".nav button.current{background:var(--panel-2);color:var(--accent);box-shadow:inset 0 0 0 1px var(--line)}""",
""".nav button.current{color:var(--accent)}""")

# ---- 4. motion rules (inside the existing reduced-motion-guarded block) ----
src = rep(src,
"""    .view.active{animation:xr-view .32s cubic-bezier(.3,.7,.3,1)}""",
"""    .view.active{animation:xr-view .32s cubic-bezier(.3,.7,.3,1)}
    .nav-glider{transition:transform .42s cubic-bezier(.3,1.25,.35,1),opacity .22s ease}
    .nav button.current .ic{animation:xr-tabpop .5s cubic-bezier(.3,.7,.3,1)}
    .nav button:active{transform:scale(.97)}
    @keyframes xr-tabpop{0%{transform:scale(.55) rotate(-12deg)}60%{transform:scale(1.18) rotate(4deg)}100%{transform:scale(1) rotate(0deg)}}
    @keyframes xr-view-fwd{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
    @keyframes xr-view-bck{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
    .view.slide-fwd{animation:xr-view-fwd .36s cubic-bezier(.3,.7,.3,1)}
    .view.slide-bck{animation:xr-view-bck .36s cubic-bezier(.3,.7,.3,1)}""")

# ---- 5. showView: directional slide + shared tab sync ----
src = rep(src,
"""function showView(name){
  VIEWS.forEach(v => $('#view-' + v).classList.toggle('active', v === name));
  $$('#btnHome,#btnSearch,#btnProject,#btnSettings').forEach(b => b.classList.remove('current'));
  if(name === 'home') $('#btnHome').classList.add('current');
  if(name === 'settings') $('#btnSettings').classList.add('current');
  if(name === 'chat') renderChat();
}""",
"""var curView = 'home';
function showView(name){
  const order = {home:0, chat:1, settings:2};
  const prevName = curView;
  VIEWS.forEach(v => $('#view-' + v).classList.toggle('active', v === name));
  const sec = $('#view-' + name);
  if(name !== prevName){
    sec.classList.remove('slide-fwd', 'slide-bck');
    void sec.offsetWidth;
    sec.classList.add(order[name] >= order[prevName] ? 'slide-fwd' : 'slide-bck');
  }
  curView = name;
  syncTabs();
  if(name === 'chat') renderChat();
}
function syncTabs(){                              // one source of truth for the selected tab
  const wrap = $('#chatSearchWrap');
  const searchOn = !!(wrap && wrap.classList.contains('open'));
  let target;
  if(searchOn) target = $('#btnSearch');
  else if(curView === 'settings') target = $('#btnSettings');
  else if(curView === 'chat') target = $('#btnProject');
  else target = $('#btnHome');
  $$('#btnHome,#btnSearch,#btnProject,#btnSettings').forEach(b => b.classList.toggle('current', b === target));
  if(window.__glide) window.__glide(target);
}
/* ---------- sidebar tab glider (pill that slides between tabs) ---------- */
(function(){
  const nav = document.querySelector('.nav');
  if(!nav) return;
  const g = document.createElement('div');
  g.className = 'nav-glider no-anim off';
  g.setAttribute('aria-hidden', 'true');
  nav.appendChild(g);
  let shown = false;
  window.__glide = function(btn){
    if(!btn) return;
    const r = btn.getBoundingClientRect(), n = nav.getBoundingClientRect();
    g.style.height = r.height + 'px';
    g.style.transform = 'translateY(' + Math.round(r.top - n.top) + 'px)';
    if(!shown){                                   // first placement: jump, no slide
      shown = true;
      requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('no-anim')));
    }
    g.classList.remove('off');
  };
  const snap = fn => {                            // reposition instantly (no slide-in on resize/fonts)
    g.classList.add('no-anim');
    fn();
    requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('no-anim')));
  };
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => snap(syncTabs), 100); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => snap(syncTabs));
  snap(syncTabs);                                 // place the pill on the boot tab
})();""")

# ---- 6. search toggle re-syncs the pill (search tab hosts it while open) ----
src = rep(src,
"""$('#btnSearch').onclick = () => {
  const w = $('#chatSearchWrap');
  w.classList.toggle('open');
  if(w.classList.contains('open')){ $('#chatSearch').focus(); runSearch($('#chatSearch').value); }
};""",
"""$('#btnSearch').onclick = () => {
  const w = $('#chatSearchWrap');
  w.classList.toggle('open');
  if(w.classList.contains('open')){ $('#chatSearch').focus(); runSearch($('#chatSearch').value); }
  syncTabs();
};""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('nav-glider') == 5, core.count('nav-glider')      # 3 base css + 1 media css + 1 js class
assert core.count('xr-tabpop') == 2
assert core.count('slide-fwd') == 3 and core.count('slide-bck') == 3
assert core.count('syncTabs') == 6, core.count('syncTabs')
assert core.count('curView') == 5, core.count('curView')
assert core.count('__glide') == 3
assert "classList.add('current')" not in core                       # old current logic fully replaced
assert '.nav button.current{color:var(--accent)}' in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — tab glider + icon pop + directional view slide')
