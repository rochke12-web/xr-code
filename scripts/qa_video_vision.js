// QA: video-attachment vision E2E on the REAL :3000.
// The app client never uploads video bytes — it canvas-samples keyframes
// client-side (videoFrames()) and sends them as image/jpeg blocks with a
// "[attached video: …N keyframes…]" text note. This test reproduces that
// payload exactly: a real 3s mp4 (red ONE / blue TWO / green THREE), sampled
// at 0s/1s/2s, model prime-vision. The reply must see the sequence in order.
const { createHmac } = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LIVE = 'http://localhost:3000';
const ROOT = '/home/z/my-project';
const TMP = '/tmp/xrvid';
const UID = '123456789012345678';

function mint(uid) {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/xrsecrets.ts'), 'utf8');
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : 'xr-dev-secret-change-me';
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(uid + '.' + iat).digest('hex').slice(0, 40);
  return `v1.${uid}.${iat}.${sig}`;
}

(async () => {
  const fails = [];
  const ok = (cond, label, extra) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  [' + extra + ']' : '')); if (!cond) fails.push(label); };

  // ---- 1. build the video + sample keyframes (what the client's canvas does) ----
  execSync(`rm -rf ${TMP} && mkdir -p ${TMP}`);
  execSync(`python3 - <<'EOF'
from PIL import Image, ImageDraw, ImageFont
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
for name, bg, label in [('f0', (200,30,30), 'ONE'), ('f1', (30,60,200), 'TWO'), ('f2', (30,160,60), 'THREE')]:
    img = Image.new('RGB', (640, 480), bg)
    d = ImageDraw.Draw(img)
    w = d.textlength(label, font=f)
    d.text(((640-w)/2, 200), label, fill=(255,255,255), font=f)
    img.save(f'/tmp/xrvid/{name}.png')
EOF`, { stdio: 'inherit' });
  execSync(`ffmpeg -y -loglevel error -framerate 1 -i ${TMP}/f%d.png -c:v libx264 -pix_fmt yuv420p ${TMP}/test.mp4`);
  const sz = fs.statSync(`${TMP}/test.mp4`).size;
  ok(sz > 2000, 'T0 real 3s mp4 built', sz + ' bytes');

  const frames = [0, 1, 2].map(i => {
    execSync(`ffmpeg -y -loglevel error -ss ${i} -i ${TMP}/test.mp4 -frames:v 1 -q:v 4 ${TMP}/k${i}.jpg`);
    return { mt: 'image/jpeg', b64: fs.readFileSync(`${TMP}/k${i}.jpg`).toString('base64') };
  });
  ok(frames.every(f => f.b64.length > 1000), 'T1 3 keyframes sampled (client-style jpeg b64)');

  // ---- 2. send exactly what the client sends for a video attachment ----
  const res = await fetch(LIVE + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'xr_ds=' + mint(UID) },
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'This is a short video I attached. [attached video: test.mp4 — ' + frames.length + ' keyframes attached as image blocks] Describe what happens in the clip: which colors and which words appear, in order?' },
          ...frames.map(f => ({ type: 'image', source: { type: 'base64', media_type: f.mt, data: f.b64 } })),
        ],
      }],
      model: 'prime-vision',
      mode: 'koder',
    }),
    signal: AbortSignal.timeout(130000),
  });
  const d = await res.json().catch(() => null);
  const text = (d && d.text || '').toLowerCase();
  ok(res.status === 200 && d && d.ok && text, 'T2 video E2E reply ok', `status=${res.status} len=${text.length}`);
  console.log('    reply: ' + (d && d.text || '').slice(0, 220));
  ok(/red|one/.test(text) && /blue|two/.test(text) && /green|three/.test(text),
    'T3 sees the whole sequence (red ONE / blue TWO / green THREE)');
  ok((text.indexOf('one') < text.indexOf('two') && text.indexOf('two') < text.indexOf('three')) ||
     (text.indexOf('red') < text.indexOf('blue') && text.indexOf('blue') < text.indexOf('green')),
    'T4 order preserved across keyframes');
  ok(!!d.vision, 'T5 [VISION] block present');

  // ---- cleanup ----
  execSync(`rm -rf ${TMP}`);
  for (const p of [path.join(ROOT, 'db/usage', UID + '.json'), path.join(ROOT, 'db/chats', UID + '.json')]) {
    try { fs.unlinkSync(p); } catch (e) {}
  }
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(1); });
