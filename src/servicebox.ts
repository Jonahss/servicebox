import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SubProcess } from 'teen_process';

const CONFIG_FILE = 'servicebox.config.yaml';
const STATE_DIR = '.servicebox';

interface ServiceConfig {
  name: string;
  command: string;
  port: number;
}

function loadConfig(): ServiceConfig[] {
  const configPath = path.resolve(process.cwd(), CONFIG_FILE);
  const file = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(file) as any;
  // Assume config is a map of service_name -> {command, port}
  return Object.entries(config.services).map(([name, svc]: [string, any]) => ({
    name,
    command: svc.command,
    port: svc.port,
  }));
}

async function startService(serviceName: string) {
  const services = loadConfig();
  const svc = services.find(s => s.name === serviceName);
  if (!svc) {
    console.error(`Service '${serviceName}' not found in config.`);
    process.exit(1);
  }
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR);
  const logPath = path.join(STATE_DIR, `${svc.name}.log`);
  const out = fs.openSync(logPath, 'a');
  const err = fs.openSync(logPath, 'a');
  // #ts ignore
  const cmdParts = svc.command ? svc.command.split(' ') : [];
  if (cmdParts.length === 0) {
    console.error(`No command specified for service '${svc.name}'.`);
    process.exit(1);
  }
  const args = cmdParts.slice(1).concat([`--port=${svc.port}`]);
  const proc = new SubProcess(String(cmdParts[0]), args, {
    stdio: ['ignore', out, err],
    detached: true,
  });
  await proc.start(0); // start immediately
  if (!proc.proc || !proc.proc.pid) {
    console.error(`Failed to start process for service '${svc.name}'.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(STATE_DIR, `${svc.name}.pid`), String(proc.proc.pid));
  console.log(`Started ${svc.name} (PID ${proc.proc.pid}) on port ${svc.port}`);
}

async function stopService(serviceName: string) {
  const pidFile = path.join(STATE_DIR, `${serviceName}.pid`);
  if (!fs.existsSync(pidFile)) {
    console.error(`No running process found for ${serviceName}.`);
    process.exit(1);
  }
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
  try {
    process.kill(pid);
    fs.unlinkSync(pidFile);
    console.log(`Stopped ${serviceName} (PID ${pid})`);
  } catch (e) {
    console.error(`Failed to stop ${serviceName}:`, e);
  }
}

// Simple CLI
const [,, cmd, serviceName] = process.argv;
if (cmd === 'start' && serviceName) {
  startService(serviceName);
} else if (cmd === 'stop' && serviceName) {
  stopService(serviceName);
} else {
  console.log('Usage: servicebox start <service_name> | stop <service_name>');
}
