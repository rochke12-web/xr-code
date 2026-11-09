// Probe: real-time model switching, visible in UI (v2)
import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));

await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1200);
const fr = pg.frames().find(f => f !== pg.mainFrame());
if (!fr) { console.log('FAIL: no iframe'); process.exit(1); }

async function pickHome(model) {
  await fr.locator('#homeModelBtn').click();
  await pg.waitForTimeout(250);
  await fr.locator('#homeModelMenu .model-item', { hasText: model }).first().click();
  await pg.waitForTimeout(200);
}
async function pickChat(model) {
  await fr.locator('#modelBtn').click();
  await pg.waitForTimeout(250);
  await fr.locator('#modelMenu .model-item', { hasText: model }).first().click();
  await pg.waitForTimeout(200);
}
async function waitReply(model) {
  // badge is appended only AFTER the real response arrives
  await fr.locator('.msg.a .who .eng', { hasText: model }).last().waitFor({ timeout: 45000 });
  await pg.waitForTimeout(400);
  const chip = (await fr.locator('#chatModelChip').textContent()).trim();
  const badge = (await fr.locator('.msg.a .who .eng').last().textContent()).trim();
  console.log(`[${model}] chip: "${chip}" | bubble badge: "${badge}"`);
  return badge;
}

// message 1 from home: glm-5.3
await pickHome('glm-5.3');
await fr.locator('#homeInput').fill('say ok');
await fr.locator('#homeForm').evaluate(f => f.requestSubmit());
const r1 = await waitReply('glm-5.3');
await pg.screenshot({ path: 'download/preview-12-engine-glm53.png' });

// message 2 in the same chat via chat composer: prime-v1-flash
await pickChat('prime-v1-flash');
await fr.locator('#chatInput').fill('say ok again');
await fr.locator('#chatForm').evaluate(f => f.requestSubmit());
const r2 = await waitReply('prime-v1-flash');
await pg.screenshot({ path: 'download/preview-13-engine-flash.png' });

console.log('switch visible in real life:', r1 === 'glm-5.3' && r2 === 'prime-v1-flash');
console.log('page errors:', errs.length ? errs : 'none');
console.log('REALTIME-SWITCH PROBE DONE');
await b.close();
