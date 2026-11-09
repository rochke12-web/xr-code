// Probe: attach a real video through the app UI, AI must actually watch it
import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));

await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1200);
const fr = pg.frames().find(f => f !== pg.mainFrame());
if (!fr) { console.log('FAIL: no iframe'); process.exit(1); }

// attach the test clip via the hidden file input in the chat form
await fr.locator('#homeInput').fill('hello');
await fr.locator('#homeForm').evaluate(f => f.requestSubmit());
await pg.waitForTimeout(1500);   // now in chat view

await fr.locator('#chatForm input[type="file"]').setInputFiles('/tmp/vtest.mp4');
await pg.waitForTimeout(500);
const chipTxt = await fr.locator('.att-chip .nm').first().textContent().catch(() => '(no chip)');
console.log('1. attach chip:', chipTxt);

// ask about the clip
await fr.locator('#chatInput').fill('What happens in this video? Name the colors in order and any text you see. Be brief.');
await fr.locator('#chatForm').evaluate(f => f.requestSubmit());
console.log('2. sent — waiting for the brain to watch the clip…');

// wait for the reply chip on the AI message
await fr.locator('.msg.a .chip').last().waitFor({ timeout: 90000 });
await pg.waitForTimeout(1500);
const replyChip = (await fr.locator('.msg.a .chip').last().textContent()).trim();
const reply = await fr.locator('.msg.a .bubble').last().textContent();
console.log('3. reply chip:', replyChip);
console.log('4. reply:', reply.trim().slice(0, 300));

const saw = /red|blue|green|purple/i.test(reply) && /xr\s*7/i.test(reply);
console.log('5. AI actually watched the video:', saw);
await pg.screenshot({ path: 'download/preview-14-video-watch.png' });
console.log('page errors:', errs.length ? errs : 'none');
console.log('VIDEO PROBE DONE');
await b.close();
