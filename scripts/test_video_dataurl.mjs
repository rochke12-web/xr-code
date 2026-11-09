// Does createVision accept a base64 data-URL video? And can it actually watch it?
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const b64 = fs.readFileSync('/tmp/vtest.mp4').toString('base64');
const url = 'data:video/mp4;base64,' + b64;

const zai = await ZAI.create();
const t0 = Date.now();
try {
  const r = await zai.chat.completions.createVision({
    model: 'glm-4.5v',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this short video: what colors appear, in what order, and any text you see. Be brief.' },
        { type: 'video_url', video_url: { url } },
      ],
    }],
    thinking: { type: 'disabled' },
  });
  console.log('OK in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('ANSWER:', (r.choices[0]?.message?.content || '').slice(0, 400));
} catch (e) {
  console.log('FAIL in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('ERR:', e.message?.slice(0, 300));
}
