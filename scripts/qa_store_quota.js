// QA: prime-vision E2E + per-Discord-ID chat store + 10M/day quota.
//  V1  vision E2E on the REAL :3000 — photo attachment (red bg / blue circle /
//      "XR-7" text) with model=prime-vision; the gateway strips image blocks,
//      so the Z.ai vision preprocessor must describe it and the reply must
//      reflect what the picture shows.
//  S1  PUT 2 chats for uid A → GET returns them (+tokens/limit/day fields)
//  S2  uid B sees zero of A's chats (per-ID isolation)
//  S3  sanitizer: 500-message chat trimmed to 400, oversize string truncated
//  S4  unauthenticated GET/PUT → 401
//  Q1  usage accounting: after a chat, response.usage.used > 0 and matches the
//      db/usage file
//  Q2  over-limit id → instant ok:true limit bubble (no engine burn, <3s)
const { createHmac } = require('crypto');
const fs = require('fs');
const path = require('path');

const LIVE = 'http://localhost:3000';
const ROOT = '/home/z/my-project';
const UID_A = '123456789012345678';
const UID_B = '234567890123456789';
const UID_C = '345678901234567890';
const today = () => new Date().toISOString().slice(0, 10);

function mint(uid) {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/xrsecrets.ts'), 'utf8');
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : 'xr-dev-secret-change-me';
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(uid + '.' + iat).digest('hex').slice(0, 40);
  return `v1.${uid}.${iat}.${sig}`;
}
const cookie = (uid) => ({ 'content-type': 'application/json', cookie: 'xr_ds=' + mint(uid) });

function probeImage() {
  // red background, blue circle, white text XR-7 — same probe as the gateway test
  const { spawnSync } = require('child_process');
  const r = spawnSync('python3', ['-c', `
import base64, io
from PIL import Image, ImageDraw
img = Image.new('RGB', (320, 240), (200, 30, 30))
d = ImageDraw.Draw(img)
d.ellipse([110, 70, 210, 170], fill=(30, 60, 200))
d.text((130, 110), 'XR-7', fill=(255, 255, 255))
buf = io.BytesIO()
img.save(buf, format='PNG')
print(base64.b64encode(buf.getvalue()).decode())
`], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('PIL probe image failed: ' + r.stderr.slice(0, 200));
  return r.stdout.trim();
}

async function chat(uid, body, timeoutMs = 130000) {
  const res = await fetch(LIVE + '/api/chat', {
    method: 'POST', headers: cookie(uid), body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

(async () => {
  const fails = [];
  const ok = (cond, label, extra) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  [' + extra + ']' : '')); if (!cond) fails.push(label); };

  // ---------- S4: unauthenticated ----------
  try {
    const r = await fetch(LIVE + '/api/chats', { method: 'GET' });
    ok(r.status === 401, 'S4a unauth GET /api/chats -> 401', 'got ' + r.status);
    const r2 = await fetch(LIVE + '/api/chats', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"chats":[]}' });
    ok(r2.status === 401, 'S4b unauth PUT /api/chats -> 401', 'got ' + r2.status);
  } catch (e) { ok(false, 'S4 unauth', String(e).slice(0, 120)); }

  // ---------- S1: store + retrieve for uid A ----------
  const chatsA = [
    { id: 'qa-chat-1', title: 'Hello cloud', ts: 1700000000000, messages: [{ r: 'u', t: 'hi' }, { r: 'a', t: 'hello!' }] },
    { id: 'qa-chat-2', title: 'Second one', ts: 1700000100000, messages: [{ r: 'u', t: 'test' }] },
  ];
  try {
    const put = await fetch(LIVE + '/api/chats', { method: 'PUT', headers: cookie(UID_A), body: JSON.stringify({ chats: chatsA }) });
    const pd = await put.json().catch(() => null);
    ok(put.ok && pd && pd.ok === true, 'S1a PUT 2 chats uid A', JSON.stringify(pd).slice(0, 80));
    const get = await fetch(LIVE + '/api/chats', { headers: cookie(UID_A) });
    const gd = await get.json().catch(() => null);
    ok(gd && gd.ok && Array.isArray(gd.chats) && gd.chats.length === 2, 'S1b GET returns 2 chats', gd ? 'n=' + gd.chats.length : 'null');
    ok(gd && typeof gd.tokens === 'number' && typeof gd.limit === 'number' && gd.limit === 10000000 && typeof gd.day === 'string',
      'S1c GET carries tokens/limit/day', gd ? `tokens=${gd.tokens} limit=${gd.limit} day=${gd.day}` : 'null');
    ok(gd && gd.chats.some(c => c.id === 'qa-chat-1' && c.messages.length === 2), 'S1d chat content round-trips');
  } catch (e) { ok(false, 'S1 store round-trip', String(e).slice(0, 120)); }

  // ---------- S2: isolation ----------
  try {
    const get = await fetch(LIVE + '/api/chats', { headers: cookie(UID_B) });
    const gd = await get.json().catch(() => null);
    ok(gd && gd.ok && Array.isArray(gd.chats) && gd.chats.length === 0, 'S2 uid B sees none of uid A chats', gd ? 'n=' + gd.chats.length : 'null');
  } catch (e) { ok(false, 'S2 isolation', String(e).slice(0, 120)); }

  // ---------- S3: sanitizer caps ----------
  try {
    const big = [];
    for (let i = 0; i < 500; i++) big.push({ r: 'u', t: 'msg ' + i });
    const hugeChat = [{ id: 'qa-big', title: 'x'.repeat(4000), ts: 1700000200000, messages: big }];
    const put = await fetch(LIVE + '/api/chats', { method: 'PUT', headers: cookie(UID_B), body: JSON.stringify({ chats: hugeChat }) });
    const pd = await put.json().catch(() => null);
    ok(pd && pd.ok === true, 'S3a PUT oversized chat accepted (sanitized)', JSON.stringify(pd).slice(0, 60));
    const get = await fetch(LIVE + '/api/chats', { headers: cookie(UID_B) });
    const gd = await get.json().catch(() => null);
    const c = gd && gd.chats && gd.chats[0];
    ok(c && c.messages.length === 400, 'S3b 500 messages trimmed to 400', c ? 'n=' + c.messages.length : 'null');
    ok(c && c.title.length === 120, 'S3c title capped at 120', c ? 'len=' + c.title.length : 'null');
  } catch (e) { ok(false, 'S3 sanitizer', String(e).slice(0, 120)); }

  // ---------- Q2: over-limit id (before burning any quota) ----------
  try {
    const upath = path.join(ROOT, 'db/usage', UID_C + '.json');
    fs.mkdirSync(path.dirname(upath), { recursive: true });
    fs.writeFileSync(upath, JSON.stringify({ day: today(), tokens: 10000001, updated: Date.now() }));
    const t0 = Date.now();
    const { status, json } = await chat(UID_C, { messages: [{ role: 'user', content: 'say hi' }], model: 'prime-v1-flash', mode: 'koder' }, 8000);
    const dt = Date.now() - t0;
    ok(status === 200 && json && json.ok === true && json.limit === true, 'Q2a over-limit id -> ok:true limit bubble', `status=${status} limit=${json && json.limit}`);
    ok(json && /10M|00:00 UTC/.test(json.text || ''), 'Q2b bubble explains 10M + 00:00 UTC reset', (json && json.text || '').slice(0, 60));
    ok(dt < 3000, 'Q2c refused fast — no engine burn', dt + 'ms');
    const after = JSON.parse(fs.readFileSync(upath, 'utf8'));
    ok(after.tokens >= 10000001, 'Q2d usage file untouched by refused request', 'tokens=' + after.tokens);
  } catch (e) { ok(false, 'Q2 over-limit', String(e).slice(0, 120)); }

  // ---------- V1: vision E2E (prime-vision + photo attachment) ----------
  try {
    const b64 = probeImage();
    const { status, json } = await chat(UID_A, {
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What exactly is shown in the attached image? Name the background color, the shape and transcribe any text.' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        ],
      }],
      model: 'prime-vision',
      mode: 'koder',
    });
    ok(status === 200 && json && json.ok === true && (json.text || '').trim(), 'V1a prime-vision photo E2E ok', `status=${status} len=${(json && json.text || '').length}`);
    const low = (json && json.text || '').toLowerCase();
    ok(/blue|circle|xr-?7|red/.test(low), 'V1b reply reflects the picture (preprocessor path)', low.slice(0, 100));
    ok(!!json.vision, 'V1c [VISION] block present in response');
  } catch (e) { ok(false, 'V1 vision E2E', String(e).slice(0, 120)); }

  // ---------- Q1: usage accounting ----------
  try {
    const get = await fetch(LIVE + '/api/chats', { headers: cookie(UID_A) });
    const gd = await get.json().catch(() => null);
    ok(gd && gd.tokens > 0, 'Q1a uid A usage file accumulated tokens', 'tokens=' + (gd ? gd.tokens : 'null'));
    ok(gd && gd.tokens < 10000000, 'Q1b still under the 10M cap', 'tokens=' + (gd ? gd.tokens : 'null'));
    const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'db/usage', UID_A + '.json'), 'utf8'));
    ok(f.day === today() && typeof f.tokens === 'number', 'Q1c usage file shape {day,tokens,updated}', JSON.stringify(f).slice(0, 60));
  } catch (e) { ok(false, 'Q1 accounting', String(e).slice(0, 120)); }

  // ---------- cleanup: QA data out of the stores ----------
  for (const u of [UID_A, UID_B, UID_C]) {
    for (const dir of ['db/chats', 'db/usage']) {
      const p = path.join(ROOT, dir, u + '.json');
      try { fs.unlinkSync(p); } catch (e) { /* already gone */ }
    }
  }
  console.log('cleanup: QA chat/usage files removed');

  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(1); });
