import { spawn as nodeSpawn } from 'child_process';
async function waitForHealthy(port, retries = 10, delayMs = 500) {
    for (let i = 0; i < retries; i++) {
        const code = await new Promise((resolve) => {
            const proc = nodeSpawn('./healthcheck.sh', ['localhost', String(port)], { stdio: 'ignore' });
            proc.on('exit', (code) => resolve(code ?? 1));
            proc.on('error', () => resolve(1));
        });
        if (code === 0)
            return;
        await new Promise(res => setTimeout(res, delayMs));
    }
    throw new Error(`Service on port ${port} did not become healthy in time.`);
}
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SubProcess } from 'teen_process';
const CONFIG_FILE = 'servicebox.config.yaml';
const STATE_DIR = '.servicebox';
function loadConfig() {
    const configPath = path.resolve(process.cwd(), CONFIG_FILE);
    const file = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(file);
    // Map of service_name -> ServiceConfig
    const services = {};
    for (const [name, svcRaw] of Object.entries(config.services)) {
        const svc = svcRaw;
        services[name] = {
            name,
            command: svc.command,
            port: svc.port,
            dependencies: svc.dependencies || [],
        };
    }
    return services;
}
// Track in-progress service starts to avoid race conditions
const serviceStartPromises = new Map();
async function startServiceWithDeps(serviceName, started = new Set()) {
    const services = loadConfig();
    if (!services[serviceName]) {
        console.error(`Service '${serviceName}' not found in config.`);
        process.exit(1);
    }
    // If already started, skip
    if (started.has(serviceName))
        return;
    // If already in progress, await the same promise
    if (serviceStartPromises.has(serviceName)) {
        await serviceStartPromises.get(serviceName);
        return;
    }
    // Start dependencies first (in parallel if possible)
    const deps = services[serviceName].dependencies || [];
    const toStart = [];
    for (const dep of deps) {
        toStart.push(startServiceWithDeps(dep, started));
    }
    await Promise.all(toStart);
    // Now start this service if not already started
    if (!started.has(serviceName)) {
        const startPromise = startSingleService(services[serviceName]);
        serviceStartPromises.set(serviceName, startPromise);
        await startPromise;
        started.add(serviceName);
        serviceStartPromises.delete(serviceName);
    }
}
async function startSingleService(svc) {
    if (!fs.existsSync(STATE_DIR))
        fs.mkdirSync(STATE_DIR);
    const pidFile = path.join(STATE_DIR, `${svc.name}.pid`);
    if (fs.existsSync(pidFile)) {
        // Check if process is still running
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
        try {
            process.kill(pid, 0); // throws if not running
            console.log(`Service '${svc.name}' is already running (PID ${pid}). Skipping.`);
            return;
        }
        catch {
            // PID file exists but process is not running, continue to start
            fs.unlinkSync(pidFile);
        }
    }
    const logPath = path.join(STATE_DIR, `${svc.name}.log`);
    const out = fs.openSync(logPath, 'a');
    const err = fs.openSync(logPath, 'a');
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
    // Wait for healthcheck to pass
    try {
        await waitForHealthy(svc.port);
    }
    catch (e) {
        console.error(`Service '${svc.name}' failed healthcheck:`, e.message);
        process.exit(1);
    }
    fs.writeFileSync(pidFile, String(proc.proc.pid));
    console.log(`Started ${svc.name} (PID ${proc.proc.pid}) on port ${svc.port} (healthy)`);
}
async function stopService(serviceName) {
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
    }
    catch (e) {
        console.error(`Failed to stop ${serviceName}:`, e);
    }
}
// Simple CLI
const [, , cmd, serviceName] = process.argv;
if (cmd === 'start' && serviceName) {
    startServiceWithDeps(serviceName);
}
else if (cmd === 'stop' && serviceName) {
    stopService(serviceName);
}
else {
    console.log('Usage: servicebox start <service_name> | stop <service_name>');
}
//# sourceMappingURL=servicebox.js.map