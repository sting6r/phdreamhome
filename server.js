const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { spawn } = require('child_process');
const path = require('path');

// Start Python AI Agent
console.log('> Starting Python AI Agent...');
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const agentScript = path.join(__dirname, 'ai-agent', 'agent_api.py');
const pythonProcess = spawn(pythonCmd, [agentScript], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PYTHON_PORT: '8000', // Ensure it runs on 8000 internally
    PYTHONPATH: path.join(__dirname, 'ai-agent')
  }
});

pythonProcess.on('error', (err) => {
  console.error('> Failed to start Python Agent:', err);
});

pythonProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`> Python Agent exited with code ${code}`);
  }
});

// Clean up python process on exit
const cleanup = () => {
  console.log('> Shutting down...');
  if (pythonProcess) pythonProcess.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

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
  if (pythonProcess) pythonProcess.kill();
  process.exit(1);
});
