// E2E visual verification of XR-Code Imagine mode
// 1. load the app, screenshot home
// 2. switch to Imagine mode via the chat pill, verify chips + placeholder
// 3. send a prompt, wait for the painted image, screenshot the chat
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[console-err]', m.text().slice(0, 160)); });
  page.on('pageerror', e => console.log('[page-err]', String(e).slice(0, 160)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const frame = page.frames().find(f => f !== page.mainFrame());
  if (!frame) { console.log('FAIL: no iframe'); process.exit(1); }
  await frame.waitForSelector('#homeInput', { timeout: 15000 });
  console.log('app booted, home input visible');
  await page.screenshot({ path: '/tmp/shot-1-home.png' });

  // open a chat context: send from home would go straight to askBrain in koder mode —
  // instead go to chat view via new project button if present, else send a noop first
  const newBtn = await frame.$('#newChatBtn, [data-new], .new-btn');
  // simpler: type into home input → switches to chat view without waiting for the reply
  await frame.fill('#homeInput', 'hello');
  await frame.press('#homeInput', 'Enter');
  await page.waitForTimeout(1200);
  console.log('chat view opened');

  // switch mode to Imagine via the chat pill menu
  await frame.click('#chatModelBtn');
  await page.waitForTimeout(400);
  await frame.click('#chatModeMenu button[data-mode="imagine"]');
  await page.waitForTimeout(600);
  const chipsHidden = await frame.$eval('#genChips', el => el.hidden);
  const pillName = await frame.$eval('#chatModelBtn .mp-n', el => el.textContent);
  const placeholder = await frame.$eval('#chatInput', el => el.placeholder);
  console.log('mode pill:', pillName, '| chips hidden:', chipsHidden, '| placeholder:', placeholder);
  await page.screenshot({ path: '/tmp/shot-2-imagine-mode.png' });

  if (chipsHidden) { console.log('FAIL: chips should be visible in imagine mode'); process.exit(1); }

  // pick a style chip (Cinematic) then send the prompt
  await frame.click('#styleChips .gen-chip[data-v="cinematic"]');
  await page.waitForTimeout(300);
  const onChip = await frame.$eval('#styleChips .gen-chip.on', el => el.dataset.v);
  console.log('style chip on:', onChip);

  await frame.fill('#chatInput', 'a lighthouse on a cliff at dawn, sea mist');
  await frame.press('#chatInput', 'Enter');
  console.log('prompt sent — waiting for the painter (up to 200s)…');

  // wait for the generated image to appear
  try {
    await frame.waitForSelector('.msg.a .gen-media img', { timeout: 200000 });
    console.log('image bubble appeared');
  } catch (e) {
    console.log('FAIL: no image bubble within 200s');
    const txt = await frame.evaluate(() => document.querySelector('#msgs')?.innerText?.slice(0, 500));
    console.log('chat text:', txt);
    await page.screenshot({ path: '/tmp/shot-3-fail.png' });
    process.exit(1);
  }
  await page.waitForTimeout(1500);
  const imgOk = await frame.evaluate(() => {
    const im = document.querySelector('.msg.a .gen-media img');
    return im ? { complete: im.complete, w: im.naturalWidth, src: im.getAttribute('src') } : null;
  });
  console.log('img state:', JSON.stringify(imgOk));
  const caption = await frame.evaluate(() => {
    const bubbles = [...document.querySelectorAll('.msg.a .bubble')];
    const last = bubbles[bubbles.length - 1];
    return last ? last.textContent.slice(0, 180) : null;
  });
  console.log('caption:', caption);
  const dl = await frame.$('.msg.a .gen-dl-btn');
  console.log('download button:', dl ? 'present' : 'MISSING');
  await page.screenshot({ path: '/tmp/shot-3-imagine-result.png' });
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
