/* live test: video generation via ZAI SDK */
const ZAI = require('z-ai-web-dev-sdk').default || require('z-ai-web-dev-sdk');

(async () => {
  const zai = await ZAI.create();
  console.log('creating video task...');
  const t0 = Date.now();
  const task = await zai.video.generations.create({
    prompt: 'A golden paper airplane flying through a blue sky over soft clouds, cinematic, smooth motion',
    quality: 'speed',
    with_audio: false,
    size: '1920x1080',
    fps: 30,
    duration: 5,
  });
  console.log('task id:', task.id, '| status:', task.task_status, '|', ((Date.now() - t0) / 1000).toFixed(1) + 's');

  let result = await zai.async.result.query(task.id);
  let polls = 0;
  while (result.task_status === 'PROCESSING' && polls < 60) {
    polls++;
    await new Promise(r => setTimeout(r, 5000));
    result = await zai.async.result.query(task.id);
    console.log(`poll ${polls}: ${result.task_status} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log('final status:', result.task_status);
  const url = result.video_result?.[0]?.url || result.video_url || result.url || result.video;
  console.log('video url:', url || '(none)');
  console.log('full result keys:', Object.keys(result).join(','));
  if (result.video_result) console.log('video_result:', JSON.stringify(result.video_result).slice(0, 300));
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
