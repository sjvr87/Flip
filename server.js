/**
 * Heroku web server for flip.app static export.
 * Serves oauth-client-metadata.json as application/json before SPA fallback.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
const OAUTH_PATH = '/oauth-client-metadata.json';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function sendFile(res, filePath, contentType, statusCode = 200) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];

  if (url === OAUTH_PATH) {
    const oauthFile = path.join(dist, 'oauth-client-metadata.json');
    if (fs.existsSync(oauthFile)) {
      sendFile(res, oauthFile, 'application/json; charset=utf-8');
      return;
    }
  }

  const relativePath = url === '/' ? 'index.html' : url.replace(/^\//, '');
  const filePath = path.normalize(path.join(dist, relativePath));

  if (!filePath.startsWith(dist)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath);
      sendFile(res, filePath, MIME[ext] ?? 'application/octet-stream');
      return;
    }

    sendFile(res, path.join(dist, 'index.html'), MIME['.html']);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`flip.app web listening on ${port}`);
});
