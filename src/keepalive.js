const http = require('http');

function startKeepAliveServer() {
  const port = parseInt(process.env.PORT || process.env.KEEPALIVE_PORT || '0', 10);
  if (!Number.isFinite(port) || port <= 0) {
    console.log('[keepalive] PORT not set; skipping HTTP server');
    return null;
  }
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('cekincki bot running');
  });
  server.listen(port, () => {
    console.log(`[keepalive] HTTP server listening on :${port}`);
  });
  server.on('error', (err) => {
    console.error('[keepalive] server error:', err.message);
  });
  return server;
}

module.exports = { startKeepAliveServer };
