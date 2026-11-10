import ZAI from 'z-ai-web-dev-sdk';
const zai = await ZAI.create();
const ids = ['kimi', 'kimi-k2', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-latest', 'moonshot-v1-8k', 'kimi-k2-thinking'];
for (const m of ids) {
  const t0 = Date.now();
  try {
    const r = await zai.chat.completions.create({
      messages: [{ role: 'user', content: 'reply with exactly: ok' }],
      model: m, thinking: { type: 'disabled' },
    });
    console.log(m.padEnd(24), 'OK', Date.now() - t0 + 'ms →', JSON.stringify(r.choices?.[0]?.message?.content).slice(0, 60));
  } catch (e) {
    const msg = String(e?.message || e);
    const code = /429/.test(msg) ? '429 quota' : /40[04]/.test(msg) ? '404/400 unknown' : /401|403/.test(msg) ? '401/403 auth' : 'other';
    console.log(m.padEnd(24), 'FAIL', Date.now() - t0 + 'ms', code, '—', msg.slice(0, 90));
  }
}
