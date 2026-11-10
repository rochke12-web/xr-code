// Verify UI text changes + polish: hero pill, chip, sidebar credit, shimmer
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const frame = page.frames().find(f => f !== page.mainFrame());
  if (!frame) { console.log('FAIL: no iframe'); process.exit(1); }
  await frame.waitForSelector('#homeInput', { timeout: 15000 });

  const pill = await frame.evaluate(() => document.querySelector('.hero-pill')?.innerText);
  const title = await page.title();
  const credit = await frame.evaluate(() => document.querySelector('.side-credit')?.innerText);
  const shimmer = await frame.evaluate(() => {
    const h = document.querySelector('.hero h2');
    return getComputedStyle(h).animationName + ' / ' + getComputedStyle(h).backgroundSize;
  });
  const drift = await frame.evaluate(() => {
    const c = document.querySelector('.clouds');
    return c ? getComputedStyle(c).animationName : 'none';
  });
  console.log('title:', title);
  console.log('hero pill:', JSON.stringify(pill));
  console.log('side credit:', JSON.stringify(credit));
  console.log('h2 shimmer:', shimmer);
  console.log('clouds drift:', drift);
  await page.screenshot({ path: '/tmp/ui-1-home.png' });

  // chat chip after a send
  await frame.fill('#homeInput', 'hi');
  await frame.press('#homeInput', 'Enter');
  await page.waitForTimeout(4000);
  const chip = await frame.evaluate(() => document.querySelector('#chatModelChip')?.innerText);
  console.log('chat chip:', JSON.stringify(chip));
  await page.screenshot({ path: '/tmp/ui-2-chat.png' });
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', String(e).slice(0, 200)); process.exit(1); });
