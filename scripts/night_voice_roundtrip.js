// night-shift: TTS → ASR roundtrip via the app's own endpoints
const http = require('http');
const fs = require('fs');
function post(path, obj, bin) {
  return new Promise((res, rej) => {
    const body = JSON.stringify(obj);
    const req = http.request({ host: 'localhost', port: 3000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 70000 }, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => res({ status: r.statusCode, buf: Buffer.concat(chunks), ct: r.headers['content-type'] }));
    });
    req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    req.on('error', rej);
    req.end(body);
  });
}
(async () => {
  const phrase = 'XR Code voice check: the brain hears what it says.';
  const t0 = Date.now();
  const tts = await post('/api/tts', { text: phrase });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  const isWav = tts.buf.slice(0, 4).toString() === 'RIFF';
  console.log('tts:', tts.status, '| ct:', tts.ct, '| bytes:', tts.buf.length, '| RIFF:', isWav, '|', sec + 's');
  fs.writeFileSync('/tmp/xr_tts.wav', tts.buf);
  const asr = await post('/api/asr', { b64: tts.buf.toString('base64') });
  const heard = JSON.parse(asr.buf.toString()).text || '';
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  console.log('asr:', asr.status, '| heard:', JSON.stringify(heard));
  console.log('roundtrip:', norm(heard).includes('xr code') && norm(heard).includes('voice') ? 'PASS' : 'CHECK');
})().catch(e => console.error('ERR:', e.message));
