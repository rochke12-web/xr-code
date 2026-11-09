/* live test: image gen, TTS wav, ASR roundtrip */
const ZAI = require('z-ai-web-dev-sdk').default || require('z-ai-web-dev-sdk');
const fs = require('fs');

(async () => {
  const zai = await ZAI.create();

  // 1. image generation
  let t0 = Date.now();
  const img = await zai.images.generations.create({ prompt: 'a small red paper airplane flying over clouds, minimal, bright', size: '1024x1024' });
  const b64 = img.data[0].base64;
  console.log('image ok:', b64.length, 'b64 chars,', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  fs.writeFileSync('/tmp/genimg.b64', b64);

  // 2. TTS → wav file
  t0 = Date.now();
  const resp = await zai.audio.tts.create({ input: 'Hello from XR Code. The GLM brain is talking now.', voice: 'tongtong', speed: 1.0, response_format: 'wav', stream: false });
  const buf = Buffer.from(new Uint8Array(await resp.arrayBuffer()));
  console.log('tts ok:', buf.length, 'bytes,', ((Date.now() - t0) / 1000).toFixed(1) + 's, head:', buf.slice(0, 4).toString());
  fs.writeFileSync('/tmp/tts.wav', buf);

  // 3. ASR roundtrip on that wav
  t0 = Date.now();
  const asr = await zai.audio.asr.create({ file_base64: buf.toString('base64') });
  console.log('asr ok:', ((Date.now() - t0) / 1000).toFixed(1) + 's, text:', JSON.stringify(asr.text).slice(0, 120));
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
