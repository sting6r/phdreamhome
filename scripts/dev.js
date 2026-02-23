
const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  yellow: "\x1b[33m"
};

console.log(`${colors.green}Starting PhDreamHome Development Environment...${colors.reset}`);

// 1. Start Python AI Agent
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const agentDir = path.join(__dirname, '..', 'ai-agent');

console.log(`${colors.blue}[AI Agent] Starting Python server on port 8000...${colors.reset}`);

const python = spawn(pythonCmd, ['agent_api.py'], {
  cwd: agentDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PYTHONPATH: agentDir }
});

python.on('error', (err) => {
  console.error(`${colors.red}[AI Agent] Failed to start Python server: ${err.message}${colors.reset}`);
});

// 2. Start Next.js App
const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const nextArgs = [nextBin, 'dev', '-p', '3000'];

console.log(`${colors.blue}[Next.js] Starting Frontend on port 3000...${colors.reset}`);

const next = spawn(process.execPath, nextArgs, { 
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

next.on('error', (err) => {
  console.error(`${colors.red}[Next.js] Failed to start Next.js: ${err.message}${colors.reset}`);
});

// Cleanup on exit
const cleanup = () => {
  console.log(`${colors.yellow}Shutting down services...${colors.reset}`);
  
  // Kill Python process
  try { 
    if (python && !python.killed) {
        if (process.platform === 'win32') {
             spawn("taskkill", ["/pid", python.pid, '/f', '/t']);
        } else {
            python.kill(); 
        }
    }
  } catch (e) {}
  
  // Kill Next.js process
  try { 
    if (next && !next.killed) {
        if (process.platform === 'win32') {
            spawn("taskkill", ["/pid", next.pid, '/f', '/t']);
        } else {
            next.kill(); 
        }
    }
  } catch (e) {}
  
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
