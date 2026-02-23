
const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const args = [nextBin, 'dev', '-p', '3000'];

const next = spawn(process.execPath, args, { 
  stdio: 'inherit'
});

const cleanup = () => {
  try { if (next && !next.killed) next.kill(); } catch (e) {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
