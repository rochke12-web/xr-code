"""modes4.py — XR CODE upgrade:
1. Mode picker: 2 -> 4 modes (Coder / QnA / Debug / Explain), icons + subs
2. Code blocks: remove the 'save/download' button -> only a fold arrow (chevron)
   with a smooth grid-rows fold animation; no download anywhere in Coder Mode.
Idempotent-ish: anchored replaces with count asserts + snapshot + node --check.
"""
import re, subprocess, shutil, os

P = '/home/z/my-project/download/xr-code.html'
SNAP = '/home/z/my-project/scripts/xr-pre-modes4.html'
shutil.copy(P, SNAP)

src = open(P, encoding='utf-8').read()
fails = []

def rep(old, new, n=1, tag=''):
    global src
    c = src.count(old)
    if c != n:
        fails.append(f'[{tag}] expected {n}, found {c}: {old[:70]!r}')
        return
    src = src.replace(old, new)

# ---------- 1. four modes ----------
rep("const LABELS = { coder: 'Coder Mode', qna: 'QnA' };",
    "const LABELS = { coder: 'Coder Mode', qna: 'QnA', debug: 'Debug Mode', explain: 'Explain Mode' };", 1, 'LABELS')
rep("const ICONS = { coder: 'i-cpu', qna: 'i-qna' };",
    "const ICONS = { coder: 'i-cpu', qna: 'i-qna', debug: 'i-bug', explain: 'i-book' };", 1, 'ICONS')
rep("const SUBS = { coder: 'writes & fixes code', qna: 'answers anything' };",
    "const SUBS = { coder: 'writes & fixes code', qna: 'answers anything', debug: 'finds & fixes bugs', explain: 'explains step by step' };", 1, 'SUBS')
rep("['coder', 'qna'].forEach(id => {",
    "['coder', 'qna', 'debug', 'explain'].forEach(id => {", 1, 'LOOP')

# ---------- 2. code block: fold arrow instead of download ----------
rep(""".code-save{
  display:inline-flex;align-items:center;gap:5px;margin-left:auto;
  font-family:var(--font-mono);font-size:10.5px;color:var(--muted);
  padding:3px 8px;border-radius:7px;transition:color .15s,background .15s;
}
.code-save:hover{color:var(--accent);background:var(--panel)}""",
""".code-fold{
  display:inline-flex;align-items:center;justify-content:center;margin-left:auto;
  width:26px;height:22px;border-radius:7px;color:var(--muted);
  transition:color .15s,background .15s;
}
.code-fold:hover{color:var(--accent);background:var(--panel)}
.code-fold svg{transform:rotate(90deg)}
.code-wrap.folded .code-fold svg{transform:rotate(0deg)}
.code-body{display:grid;grid-template-rows:1fr;overflow:hidden}
.code-body>pre{min-height:0}
.code-wrap.folded .code-body{grid-template-rows:0fr}
.code-wrap.folded .code-bar{border-bottom:1px solid var(--line);border-radius:12px}
@media (prefers-reduced-motion:no-preference){
  .code-body{transition:grid-template-rows .32s ease}
  .code-fold svg{transition:transform .28s cubic-bezier(.3,1.25,.35,1)}
}""", 1, 'CSS')

rep("""  const save = document.createElement('button'); save.className = 'code-save'; save.type = 'button'; save.title = 'Download this file';
  save.innerHTML = '<svg class="ic small"><use href="#i-down"/></svg>save';
  save.onclick = () => saveCodeFile(code, ext);
  bar.append(name, save);
  const pre = document.createElement('pre'); pre.textContent = code;
  wrap.append(bar, pre);""",
"""  const fold = document.createElement('button'); fold.className = 'code-fold'; fold.type = 'button'; fold.title = 'Fold / unfold this code';
  fold.innerHTML = '<svg class="ic small"><use href="#i-chev"/></svg>';
  fold.onclick = () => wrap.classList.toggle('folded');
  bar.append(name, fold);
  const body = document.createElement('div'); body.className = 'code-body';
  const pre = document.createElement('pre'); pre.textContent = code;
  body.append(pre);
  wrap.append(bar, body);""", 1, 'CODEBLOCK')

rep("""function saveCodeFile(code, ext){
  const a = document.createElement('a');
  const blob = new Blob([code], { type: 'text/plain' });
  a.href = URL.createObjectURL(blob);
  a.download = 'xr-code.' + ext;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Saved xr-code.' + ext);
}
function splitFence(t){""",
"function splitFence(t){", 1, 'SAVEREMOVE')

rep("/* ---------- AI file write: save code replies as real files ---------- */",
    "/* ---------- AI code replies: fence split + foldable code blocks ---------- */", 1, 'COMMENT')

if fails:
    print('FAIL: no changes written')
    [print(' ', f) for f in fails]
    raise SystemExit(1)

open(P, 'w', encoding='utf-8').write(src)

# ---------- sanity ----------
plain = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
checks = {
    '.code-save': 0, 'saveCodeFile': 0, 'Download this file': 0,
    '.code-fold': 5, '.code-body': 4, 'folded': 4,
    "debug: 'Debug Mode'": 1, "explain: 'Explain Mode'": 1,
    "'coder', 'qna', 'debug', 'explain'": 1,
}
bad = {k: (plain.count(k), v) for k, v in checks.items() if plain.count(k) != v}
if bad:
    print('SANITY FAIL:', bad); raise SystemExit(1)

# node --check on the app script
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/modes4_check.js', 'w').write(m.group(1))
r = subprocess.run(['node', '--check', '/tmp/modes4_check.js'], capture_output=True, text=True)
print('node --check:', r.returncode, r.stderr[:400])
print('OK  snapshot:', SNAP)
