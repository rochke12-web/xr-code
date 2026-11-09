// probe: models removed — blank composer, one brain, no model names anywhere
const { chromium } = require('playwright');

(async () => {
  const pg = await chromium.launch().then(b => b.newPage({ viewport: { width: 1366, height: 850 } }));
  await pg.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  const fr = pg.frames().find(f => f !== pg.mainFrame());
  if (!fr) { console.log('FAIL: no iframe'); process.exit(1); }

  // 1) no model selector anywhere
  const modelUi = await fr.evaluate(() => ({
    wraps: document.querySelectorAll('.model-wrap').length,
    btns: document.querySelectorAll('.model-btn').length,
    menus: document.querySelectorAll('.model-menu').length,
    modelBtn: !!document.getElementById('modelBtn'),
    homeModelBtn: !!document.getElementById('homeModelBtn'),
    modelText: /prime-v1|glm-5|glm-4/i.test(document.body.innerText),
    engineWord: /engine:/i.test(document.body.innerText),
  }));
  console.log('model UI check:', JSON.stringify(modelUi));

  // 2) send a message from home — the single brain must answer
  await fr.fill('#homeInput', 'Reply with one short sentence: what are you?');
  await pg.screenshot({ path: 'download/preview-14-home-blank.png' });
  await fr.click('#homeForm .send-btn');

  // chip should show a thinking state, never a model name
  await pg.waitForTimeout(700);
  const chipMid = await fr.evaluate(() => {
    const c = document.getElementById('chatModelChip');
    return c ? c.textContent : '(no chip)';
  });
  console.log('chip while thinking:', chipMid);

  // wait for the reply bubble
  await fr.waitForSelector('.msg.a .bubble', { timeout: 45000 });
  await pg.waitForTimeout(2500); // let typing animation finish-ish
  const state = await fr.evaluate(() => {
    const chip = document.getElementById('chatModelChip');
    const ans = [...document.querySelectorAll('.msg.a .bubble')].pop();
    return {
      chip: chip ? chip.textContent : '(no chip)',
      reply: ans ? ans.textContent.slice(0, 120) : '(none)',
      badges: document.querySelectorAll('.msg .eng').length,
      chipsInMsgs: [...document.querySelectorAll('.msgs .chip')].map(c => c.textContent),
      anyModelName: /prime-v1|glm-5|glm-4|deepseek|gpt-/i.test(document.body.innerText),
    };
  });
  console.log('after reply:', JSON.stringify(state, null, 1));

  await pg.screenshot({ path: 'download/preview-15-chat-noeng.png' });
  await pg.waitForTimeout(2000);
  await pg.screenshot({ path: 'download/preview-15b-chat-full.png' });

  const ok =
    modelUi.wraps === 0 && modelUi.btns === 0 && !modelUi.modelBtn && !modelUi.homeModelBtn &&
    !modelUi.modelText && !modelUi.engineWord &&
    state.badges === 0 && state.chipsInMsgs.length === 0 &&
    state.reply && state.reply !== '(none)' && !state.anyModelName;
  console.log(ok ? 'PASS: models fully removed, brain answers, no model names' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
