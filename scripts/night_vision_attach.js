const http = require('http');
const fs = require('fs');
const img = fs.readFileSync('/tmp/agent_img.png').toString('base64');
const body = JSON.stringify({
  messages: [{ role: 'user', content: [
    { type: 'text', text: 'what do you see in this picture? one sentence.' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } }
  ]}],
  mode: 'qna'
});
const t0 = Date.now();
const req = http.request({ host: 'localhost', port: 3000, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 120000 }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    console.log('ok:', j.ok, '| engine:', j.engine, '| vision-block:', j.vision ? 'YES (' + j.vision.length + ' chars)' : 'no', '| sec:', ((Date.now() - t0) / 1000).toFixed(1));
    console.log('--- vision block ---');
    console.log((j.vision || '').slice(0, 250));
    console.log('--- answer ---');
    console.log((j.text || '').slice(0, 300));
  });
});
req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); });
req.on('error', e => console.log('ERR:', e.message));
req.end(body);
