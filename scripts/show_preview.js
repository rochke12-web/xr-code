const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const OUT = '/home/z/my-project/download';
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f !== p.mainFrame());

  // 1. clean hero (no modes)
  await p.screenshot({ path: OUT + '/preview-1-home.png', fullPage: false });

  // 2. real smart conversation: knowledge question with live web + sources
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'who is the richest person in the world right now?'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  let done = false;
  for (let i = 0; i < 50 && !done; i++) {
    await p.waitForTimeout(2000);
    done = await fr.evaluate(() => !document.querySelector('#msgs .dots') &&
      (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || { textContent: '' }).textContent.length > 20);
  }
  await p.waitForTimeout(2500); // let the typewriter finish
  const st = await fr.evaluate(() => ({
    chip: document.getElementById('chatModelChip').textContent,
    ans: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
  }));
  console.log('ANSWER:', st.chip, '|', st.ans.slice(0, 160).replace(/\n/g, ' | '));
  await p.screenshot({ path: OUT + '/preview-2-chat.png', fullPage: false });
  await b.close();
  console.log('saved: preview-1-home.png, preview-2-chat.png');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
