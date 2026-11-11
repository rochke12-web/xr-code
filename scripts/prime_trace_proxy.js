// Logging MITM proxy: forwards /v1/messages to the real Prime Gateway so the
// primeChat code path can be traced end-to-end. Logs method, path, auth prefix,
// and the requested model — never the full key.
const http = require('http');

const UP = 'https://r1de49ege2k1-d.space-z.ai';
const LOG = '/tmp/prime_proxy.log';

const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    let model = '', keyPrefix = '', authType = 'none';
    try {
      const j = JSON.parse(body);
      model = j.model || '';
    } catch (e) {}
    if (req.headers['x-api-key']) { authType = 'x-api-key'; keyPrefix = String(req.headers['x-api-key']).slice(0, 8); }
    else if (req.headers['authorization']) { authType = 'authorization'; keyPrefix = String(req.headers['authorization']).slice(0, 16); }
    const line = `${new Date().toISOString()} ${req.method} ${req.url} model=${model} auth=${authType}:${keyPrefix}... bytes=${body.length}\n`;
    require('fs').appendFileSync(LOG, line);
    console.log(line.trim());

    const up = new URL(UP + req.url);
    const rh = { ...req.headers };
    delete rh.host;
    delete rh.connection;
    delete rh['content-length'];
    const ureq = fetch(up, { method: req.method, headers: rh, body: body || undefined })
      .then(async ures => {
        const buf = Buffer.from(await ures.arrayBuffer());
        require('fs').appendFileSync(LOG, `  -> ${ures.status} ${buf.length}B\n`);
        res.writeHead(ures.status, Object.fromEntries(ures.headers));
        res.end(buf);
      })
      .catch(e => {
        require('fs').appendFileSync(LOG, `  -> UPSTREAM ERROR ${e}\n`);
        res.writeHead(502); res.end('upstream error');
      });
  });
});
srv.listen(3200, () => console.log('prime trace proxy on :3200 -> ' + UP));
