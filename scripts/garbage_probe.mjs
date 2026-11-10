import ZAI from 'z-ai-web-dev-sdk';
const zai = await ZAI.create();
for (const m of ['totally-fake-model-xyz', 'not-a-real-model-123']) {
  const t0 = Date.now();
  try {
    await zai.chat.completions.create({ messages: [{ role: 'user', content: 'ok' }], model: m });
    console.log(m, 'OK??');
  } catch (e) {
    console.log(m.padEnd(26), String(e?.message || e).slice(0, 80), '(' + (Date.now() - t0) + 'ms)');
  }
}
