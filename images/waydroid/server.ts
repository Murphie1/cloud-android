import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// ---- Configuration ----
const PORT = Number(process.env.PORT || 3000);
const TEMP_DIR = path.resolve(process.env.TEMP_DIR || '.android_tmp');
const API_KEY = process.env.API_KEY || ''; // simple auth: set API_KEY to lock down access
const DEFAULT_TIMEOUT = 15000; // ms

// ---- Helpers / Types ----
type ActionArgs = Record<string, any> | undefined;

type WsPayload = {
  requestId?: string;
  action: string;
  args?: ActionArgs;
};

// Ensure temp dir exists
(async () => {
  await fs.mkdir(TEMP_DIR, { recursive: true });
})();

function runWithTimeout<T>(p: Promise<T>, timeout = DEFAULT_TIMEOUT) {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

function normalizeDevicePath(devicePath: string) {
  // Use POSIX normalization because adb/device paths are POSIX-like
  const normalized = path.posix.normalize(devicePath);
  return normalized;
}

function validatePath(devicePath: string) {
  if (typeof devicePath !== 'string') throw new Error('Path must be a string');
  const allowedPrefixes = ['/sdcard/', '/storage/emulated/0/', '/data/local/tmp/'];
  const normalized = normalizeDevicePath(devicePath);
  if (!allowedPrefixes.some(p => normalized.startsWith(p))) {
    throw new Error(`Disallowed path: ${devicePath}`);
  }
  // prevent things like /sdcard/../data/
  if (normalized.includes('..')) throw new Error('Relative traversal is not allowed');
  return normalized;
}

function sanitizeForShell(input: any) {
  if (typeof input !== 'string') return input;
  // escape double quotes and backticks; disallow ; & | > <
  // keep it simple: remove chars that can break command composition
  return input.replace(/[;&|<>`\\]/g, '');
}

async function adbSpawnCollect(args: string[], input?: Buffer | string) : Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('adb', args);
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c) => chunks.push(Buffer.from(c)));
    child.stderr.on('data', (c) => chunks.push(Buffer.from(c)));
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      const out = Buffer.concat(chunks).toString('utf8');
      if (code !== 0) return reject(new Error(`adb ${args.join(' ')} exited ${code}: ${out}`));
      resolve(out);
    });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

async function adbSpawnBuffer(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('adb', args);
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c) => chunks.push(Buffer.from(c)));
    child.stderr.on('data', (c) => {}); // ignore stderr for binary output
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`adb ${args.join(' ')} exited ${code}`));
      resolve(Buffer.concat(chunks));
    });
  });
}

async function adbShell(cmd: string) {
  // wrap in sh -c to support complex constructs and $! when necessary
  const sanitized = sanitizeForShell(cmd);
  return adbSpawnCollect(['shell', 'sh', '-c', sanitized]);
}

// A small mapping of functions that need binary data
let recordingPID: string | null = null;

async function runCommand(action: string, args?: ActionArgs): Promise<any> {
  try {
    switch (action) {
      // ----- Input -----
      case 'tap': {
        if (typeof args?.x !== 'number' || typeof args?.y !== 'number') throw new Error('Invalid coordinates');
        return adbShell(`input tap ${args.x} ${args.y}`);
      }

      case 'swipe': {
        const { x1, y1, x2, y2, duration = 300 } = args || {};
        if ([x1, y1, x2, y2].some(v => typeof v !== 'number')) throw new Error('Invalid swipe coordinates');
        return adbShell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
      }

      case 'keyevent':
        return adbShell(`input keyevent ${sanitizeForShell(String(args?.code || ''))}`);

      case 'longPress': {
        const { x, y, duration = 1000 } = args || {};
        if (typeof x !== 'number' || typeof y !== 'number') throw new Error('Invalid coords');
        return adbShell(`input swipe ${x} ${y} ${x} ${y} ${duration}`);
      }

      case 'inputText':
        return adbShell(`input text "${sanitizeForShell(String(args?.text || ''))}"`);

      // ----- Screenshot (binary) -----
      case 'screenshot': {
        // Use exec-out to stream raw PNG. adb exec-out prints raw bytes.
        const buf = await adbSpawnBuffer(['exec-out', 'screencap', '-p']);
        return buf.toString('base64');
      }

      // ----- File ops -----
      case 'installApk': {
        if (!args?.file) throw new Error('Missing file');
        const tmpFile = path.join(TEMP_DIR, `app_${Date.now()}.apk`);
        await fs.writeFile(tmpFile, Buffer.from(args.file, 'base64'));
        try {
          await adbSpawnCollect(['install', '-r', tmpFile]);
          return 'Installed';
        } finally {
          await fs.unlink(tmpFile).catch(() => {});
        }
      }

      case 'installApkFromUrl': {
        if (!args?.url) throw new Error('Missing url');
        // Node 18+ has global fetch. If unavailable this will throw.
        // We do not import node-fetch to keep the file minimal — ensure runtime has fetch.
        // The downloaded content is saved and installed.
        const tmpFile = path.join(TEMP_DIR, `remote_${Date.now()}.apk`);
        const res = await fetch(String(args.url));
        if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
        const array = new Uint8Array(await res.arrayBuffer());
        await fs.writeFile(tmpFile, Buffer.from(array));
        try {
          await adbSpawnCollect(['install', '-r', tmpFile]);
          return 'Installed';
        } finally {
          await fs.unlink(tmpFile).catch(() => {});
        }
      }

      case 'pushFile': {
        if (!args?.dest || !args?.file) throw new Error('Missing args');
        const dest = validatePath(String(args.dest));
        const tmpFile = path.join(TEMP_DIR, `push_${Date.now()}`);
        await fs.writeFile(tmpFile, Buffer.from(args.file, 'base64'));
        try {
          await adbSpawnCollect(['push', tmpFile, dest]);
          return 'Pushed';
        } finally {
          await fs.unlink(tmpFile).catch(() => {});
        }
      }

      case 'pullFile': {
        if (!args?.path) throw new Error('Missing path');
        const devPath = validatePath(String(args.path));
        const tmpFile = path.join(TEMP_DIR, `pull_${Date.now()}`);
        await adbSpawnCollect(['pull', devPath, tmpFile]);
        const data = await fs.readFile(tmpFile);
        await fs.unlink(tmpFile).catch(() => {});
        return data.toString('base64');
      }

      case 'listDir': {
        if (!args?.path) throw new Error('Missing path');
        const devPath = validatePath(String(args.path));
        return adbShell(`ls -l ${devPath}`);
      }

      case 'deleteFile': {
        if (!args?.path) throw new Error('Missing path');
        const devPath = validatePath(String(args.path));
        return adbShell(`rm "${sanitizeForShell(devPath)}"`);
      }

      case 'fileInfo': {
        if (!args?.path) throw new Error('Missing path');
        const devPath = validatePath(String(args.path));
        const res = await adbShell(`ls -l "${sanitizeForShell(devPath)}"`);
        const parts = res.trim().split(/\s+/);
        // best-effort parsing
        return {
          raw: res,
          parsed: parts
        };
      }

      // ----- Recording -----
      case 'startRecording': {
        // Start background screenrecord and echo pid. Wrap in sh -c to ensure backgrounding works.
        const out = await adbSpawnCollect(['shell', 'sh', '-c', 'screenrecord /sdcard/record.mp4 > /dev/null 2>&1 & echo $!']);
        recordingPID = out.trim();
        return `Recording started (PID: ${recordingPID})`;
      }

      case 'stopRecording': {
        if (!recordingPID) throw new Error('No active recording');
        await adbShell(`kill -INT ${recordingPID}`);
        // small delay to let device finalize file
        await new Promise(r => setTimeout(r, 2000));
        const fileB64 = await runCommand('pullFile', { path: '/sdcard/record.mp4' });
        recordingPID = null;
        return fileB64;
      }

      // ----- App management -----
      case 'listInstalledApps': {
        const out = await adbSpawnCollect(['shell', 'pm', 'list', 'packages', '-f']);
        return out.split('\n').filter(Boolean).map(line => {
          const match = line.match(/^package:(.*?)=(.+)$/);
          return match ? { apk: match[1], package: match[2] } : { raw: line };
        });
      }

      case 'uninstallApp':
        if (!args?.pkg) throw new Error('Missing package');
        return adbSpawnCollect(['uninstall', sanitizeForShell(String(args.pkg))]);

      case 'switchLauncher':
        if (!args?.pkg) throw new Error('Missing package');
        await adbShell(`am start -a android.intent.action.MAIN -c android.intent.category.HOME -n ${sanitizeForShell(String(args.pkg))}/.Launcher`);
        return 'Launcher changed';

      case 'startApp':
        if (!args?.package) throw new Error('Missing package');
        return adbShell(`monkey -p ${sanitizeForShell(String(args.package))} 1`);

      case 'clearAppData':
        if (!args?.package) throw new Error('Missing package');
        return adbShell(`pm clear ${sanitizeForShell(String(args.package))}`);

      // ----- Device / System -----
      case 'reboot':
        return adbSpawnCollect(['reboot']);

      case 'batteryLevel': {
        const out = await adbShell('dumpsys battery');
        const m = out.match(/level:\s*(\d+)/);
        return m ? Number(m[1]) : -1;
      }

      case 'getProp':
        if (!args?.prop) throw new Error('Missing prop');
        return adbShell(`getprop ${sanitizeForShell(String(args.prop))}`);

      case 'networkStatus': {
        const [wifi, data] = await Promise.all([
          adbShell("dumpsys wifi | grep \"Wi-Fi is\" || true"),
          adbShell("dumpsys telephony.registry | grep \"mDataConnectionState\" || true")
        ]);
        return {
          wifi: String(wifi).includes('enabled'),
          mobileData: String(data).includes('2')
        };
      }

      // ----- Debugging -----
      case 'uiDump': {
        const dumpPath = '/sdcard/ui.xml';
        await adbShell(`uiautomator dump ${dumpPath}`);
        return runCommand('pullFile', { path: dumpPath });
      }

      case 'takeBugReport': {
        const zipPath = path.join(TEMP_DIR, `bugreport_${Date.now()}.zip`);
        await adbSpawnCollect(['bugreport', zipPath]);
        const data = await fs.readFile(zipPath);
        await fs.unlink(zipPath).catch(() => {});
        return data.toString('base64');
      }

      // ----- Settings / Permissions -----
      case 'putSetting':
        if (!args?.namespace || !args?.key) throw new Error('Missing args');
        return adbShell(`settings put ${sanitizeForShell(String(args.namespace))} ${sanitizeForShell(String(args.key))} ${sanitizeForShell(String(args.value || ''))}`);

      case 'grantPermission':
        if (!args?.package || !args?.permission) throw new Error('Missing args');
        return adbShell(`pm grant ${sanitizeForShell(String(args.package))} ${sanitizeForShell(String(args.permission))}`);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    throw new Error(`Action ${action} failed: ${err?.message || String(err)}`);
  }
}

// ---- Fastify server with websocket endpoint ----
const fastify = Fastify({ logger: true });

fastify.register(fastifyWebsocket as any);

// Simple auth check (API_KEY empty = disabled)
function checkAuth(req: any): boolean {
  if (!API_KEY) return true;
  const header = req.headers?.['x-api-key'] || req.query?.api_key || req.headers?.authorization;
  if (!header) return false;
  return header === API_KEY || (String(header).startsWith('Bearer ') && String(header).slice(7) === API_KEY);
}

fastify.get('/ws', { websocket: true }, (connection: any, req: any) => {
  if (!checkAuth(req)) {
    connection.socket.send(JSON.stringify({ status: 'error', error: 'Unauthorized' }));
    return connection.socket.close();
  }

  connection.socket.on('message', async (raw: Buffer | string) => {
    let payload: WsPayload;
    try {
      payload = JSON.parse(String(raw));
    } catch (e) {
      return connection.socket.send(JSON.stringify({ status: 'error', error: 'Invalid JSON payload' }));
    }

    const { action, args, requestId } = payload;
    try {
      const result = await runWithTimeout(runCommand(action, args), DEFAULT_TIMEOUT);
      connection.socket.send(JSON.stringify({ requestId, action, status: 'ok', data: result }));
    } catch (err: any) {
      connection.socket.send(JSON.stringify({ requestId, action, status: 'error', error: err?.message || String(err) }));
    }
  });
});

fastify.post('/api/action', async (req: any, reply: any) => {
  if (!checkAuth(req)) return reply.code(401).send({ status: 'error', error: 'Unauthorized' });
  const { action, args } = req.body || {};
  if (!action) return reply.code(400).send({ status: 'error', error: 'Missing action' });

  try {
    const data = await runWithTimeout(runCommand(action, args), DEFAULT_TIMEOUT);
    return reply.send({ status: 'ok', action, data });
  } catch (err: any) {
    return reply.code(500).send({ status: 'error', action, error: err?.message || String(err) });
  }
});

// health
fastify.get('/health', async () => ({ status: 'ok' }));

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Android Pod Agent running on ws://0.0.0.0:${PORT}/ws`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
