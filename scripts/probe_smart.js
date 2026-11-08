const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  async function ask(q, loops) {
    await fr.evaluate(t => { document.getElementById('chatInput').value = t; }, q);
    await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
    let done = false;
    for (let i = 0; i < (loops || 45) && !done; i++) {
      await p.waitForTimeout(2000);
      done = await fr.evaluate(() => !document.querySelector('#msgs .dots') &&
        (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || { textContent: '' }).textContent.length > 20);
    }
    await p.waitForTimeout(800);
    return fr.evaluate(() => ({
      chip: document.getElementById('chatModelChip').textContent,
      ans: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
      retry: document.querySelectorAll('#msgs .retry-btn').length,
    }));
  }

  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);

  // 1. reasoning (thinking mode, no web) — correct answer: 90 + 60 = 150 km
  const r1 = await ask('A train travels 60 km/h for 1.5 hours, then 80 km/h for 45 minutes. What total distance does it cover?');
  console.log('REASON:', r1.chip, '|', r1.ans.slice(0, 200).replace(/\n/g, ' | '), '| retry:', r1.retry);

  // 2. follow-up pair — second search must inherit the topic
  await fr.evaluate(() => { showView('home'); });
  await p.waitForTimeout(400);
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  const r2 = await ask('who is the ceo of tesla?');
  console.log('CEO   :', r2.chip, '|', r2.ans.slice(0, 140).replace(/\n/g, ' | '), '| retry:', r2.retry);
  const r3 = await ask('how old is he?');
  console.log('FOLLOW:', r3.chip, '|', r3.ans.slice(0, 200).replace(/\n/g, ' | '), '| retry:', r3.retry);
  await p.screenshot({ path: '/tmp/render/smart-follow.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
