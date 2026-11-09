const http = require('http');
function ask(content) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ messages: [{ role: 'user', content }], mode: 'koder' });
    const req = http.request({ host: 'localhost', port: 3000, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 90000 }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch { res({ ok: false }); } });
    });
    req.on('timeout', () => { req.destroy(); res({ ok: false }); });
    req.on('error', () => res({ ok: false }));
    req.end(body);
  });
}
(async () => {
  const t0 = Date.now();
  const j = await ask('Write an async JavaScript function retryWithBackoff(fn, opts) that retries a failing async fn up to opts.retries times with exponential backoff (opts.base ms), jitter optional, and preserves the last error. Short, no comments.');
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  const text = j.text || '';
  const checks = {
    ok: j.ok,
    engine: j.engine,
    hasFence: /```/.test(text),
    exponential: /Math\.pow|2 \*\*|\*\*|base\s*\*\s*/.test(text),
    preservesError: /last|throw|err/i.test(text),
    timeoutCap: /max|cap|opts/i.test(text),
    noPlaceholder: !/\/\/ ?\.\.\.|rest of|TODO/.test(text),
  };
  console.log('sec:', sec, JSON.stringify(checks));
  console.log('--- code ---'); console.log(text.slice(0, 800));
})().catch(e => console.error('ERR', e.message));
