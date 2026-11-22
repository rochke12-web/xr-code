// Live preview: boot the app, switch to Image mode, paint one prompt through
// the new worker-pool arena, screenshot the result.
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('pageerror', e => console.log('[page-err]', String(e).slice(0, 160)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);
  const getFrame = () => page.frames().find(f => f !== page.mainFrame() && (f.url().length || true));
  let frame = getFrame();
  if (!frame) { console.log('FAIL: no iframe'); process.exit(1); }
  await frame.waitForSelector('#homeInput', { timeout: 20000 });
  console.log('app booted');

  // open chat view, switch to Image mode (re-resolve frame — the shell reloads srcdoc)
  const frameWait = async (sel, t = 20000) => {
    for (let i = 0; i < 8; i++) {
      frame = getFrame();
      if (frame) {
        try { return await frame.waitForSelector(sel, { timeout: t }); }
        catch { await page.waitForTimeout(1200); }
      }
    }
    throw new Error('no frame/selector ' + sel);
  };
  await frameWait('#homeInput');
  // pick Image mode from the HOME pill (no chat-view hop needed)
  await (await frameWait('#homeModelBtn')).click();
  await page.waitForTimeout(400);
  await (await frameWait('#homeModeMenu button[data-mode="image"]')).click();
  await page.waitForTimeout(600);
  frame = getFrame();
  const sizeChip = await frame.$$eval('#sizeChips .gen-chip.on', els => els.map(e => e.textContent));
  const modelChip = await frame.$('#imgModelChips');
  console.log('size chip on:', JSON.stringify(sizeChip), '| imgModelChips exists:', !!modelChip);

  // paint straight from home — image mode send routes into the chat arena
  await frame.fill('#homeInput', 'a golden retriever astronaut floating over a neon Mars city at dusk, cinematic');
  await frame.press('#homeInput', 'Enter');
  console.log('prompt sent — waiting for the arena…');

  const img = await frameWait('.msg img[src*="/api/asset/"], img[src*="/api/asset/"]', 90000);
  const src = await img.getAttribute('src');
  console.log('painted:', src);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/z/my-project/download/photo-preview.png', fullPage: false });
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FAIL', String(e).slice(0, 300)); process.exit(1); });
