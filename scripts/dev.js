
const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

console.log(`${colors.green}Starting development environment...${colors.reset}`);

// Start Python Agent
console.log(`${colors.yellow}Starting Python AI Agent on port 8000...${colors.reset}`);
// Run from ai-agent directory so imports work correctly
const pythonCwd = path.join(__dirname, '..', 'ai-agent');
const pythonArgs = ['-m', 'uvicorn', 'agent_api:app', '--reload', '--port', '8000'];
const python = spawn('python', pythonArgs, {
  stdio: 'inherit',
  shell: true,
  cwd: pythonCwd
});

python.on('error', (err) => {
  console.error(`${colors.red}Failed to start Python agent:${colors.reset}`, err);
});

// Start Next.js
console.log(`${colors.blue}Starting Next.js on port 3000...${colors.reset}`);
const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const nextArgs = ['dev', '-p', '3000'];

const next = spawn(process.execPath, [nextBin, ...nextArgs], { 
  stdio: 'inherit'
});

next.on('error', (err) => {
  console.error(`${colors.red}Failed to start Next.js:${colors.reset}`, err);
});

const cleanup = () => {
  console.log(`${colors.yellow}Shutting down services...${colors.reset}`);
  try { 
    if (next && !next.killed) next.kill(); 
    if (python && !python.killed) python.kill();
  } catch (e) {
    console.error('Error during cleanup:', e);
  }
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
