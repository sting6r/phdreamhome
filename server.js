const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

console.log('> Starting Next.js app...');
const app = next({ dev: false });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3005;

console.log(`> Environment PORT: ${process.env.PORT}`);
console.log(`> Using port: ${port}`);

app.prepare().then(() => {
  console.log('> Next.js app prepared. Starting server...');
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://0.0.0.0:${port}`);
  });
}).catch((err) => {
  console.error('> Error during app.prepare():', err);
  process.exit(1);
});
