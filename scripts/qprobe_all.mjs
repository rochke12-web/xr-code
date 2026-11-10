import ZAI from 'z-ai-web-dev-sdk';
const zai = await ZAI.create();
for (const m of ['glm-4.5-flash', 'glm-4.6', 'dpsk-4.1-flash', 'dpsk-4.1', 'argon-1.0']) {
  const t0 = Date.now();
  try {
    await zai.chat.completions.create({ messages: [{ role: 'user', content: 'ok' }], model: m, thinking: { type: 'disabled' } });
    console.log(m.padEnd(16), 'OK', Date.now() - t0 + 'ms');
  } catch (e) { console.log(m.padEnd(16), 'FAIL', Date.now() - t0 + 'ms', String(e?.message || e).slice(0, 60)); }
}
