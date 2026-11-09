import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

// real 160x160 PNG (red bg, blue circle) generated with PIL
const b64 = fs.readFileSync('/tmp/vtest.png').toString('base64');
const url = 'data:image/png;base64,' + b64;

const candidates = ['glm-4.5v', 'glm-4v', 'glm-4.6v', ''];
for (const model of candidates) {
  try {
    const zai = await ZAI.create();
    const body = {
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What color is this image? One word.' },
          { type: 'image_url', image_url: { url } },
        ],
      }],
      thinking: { type: 'disabled' },
    };
    if (model) body.model = model;
    const res = await zai.chat.completions.createVision(body);
    const text = res?.choices?.[0]?.message?.content;
    console.log('MODEL=' + JSON.stringify(model) + ' => ' + JSON.stringify(text).slice(0, 120));
  } catch (e) {
    console.log('MODEL=' + JSON.stringify(model) + ' => ERROR: ' + String(e.message || e).slice(0, 160));
  }
}
