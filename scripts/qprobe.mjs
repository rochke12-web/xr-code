import ZAI from 'z-ai-web-dev-sdk';
const zai = await ZAI.create();
const t0 = Date.now();
try {
  const r = await zai.chat.completions.create({
    messages: [{ role: 'user', content: 'ok' }],
    model: 'glm-4.5-flash', thinking: { type: 'disabled' },
  });
  console.log('OK in', Date.now() - t0, 'ms →', JSON.stringify(r.choices?.[0]?.message?.content).slice(0, 120));
} catch (e) {
  console.log('FAIL in', Date.now() - t0, 'ms');
  const s = String(e?.message || e);
  console.log('msg:', s.slice(0, 300));
  const resp = e?.response;
  if (resp) {
    console.log('status:', resp.status);
    const h = resp.headers || {};
    for (const k of ['retry-after', 'x-ratelimit-reset', 'x-ratelimit-remaining', 'ratelimit-reset', 'x-quota-reset']) {
      if (h[k]) console.log('header', k, '=', h[k]);
    }
    try { console.log('body:', JSON.stringify(resp.data).slice(0, 300)); } catch {}
  }
}
