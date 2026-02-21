
const { spawn } = require('child_process');

// Use npx.cmd on Windows, npx on other platforms
const next = spawn('npx', ['next', 'dev', '-p', '3000'], { 
  stdio: 'inherit',
  shell: true 
});

const cleanup = () => {
  try { if (next && !next.killed) next.kill(); } catch (e) {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
