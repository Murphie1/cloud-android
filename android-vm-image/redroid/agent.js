import { WebSocketServer } from 'ws';
import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const wss = new WebSocketServer({ port: 8081 });
const TEMP_DIR = './.android_tmp';
let recordingPID = null;

// Create temp directory if not exists
(async () => {
  await fs.mkdir(TEMP_DIR, { recursive: true });
})();

function runWithTimeout(promise, timeout = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(`Timeout after ${timeout}ms`), timeout)
    )
  ]);
}

function validatePath(devicePath) {
  const allowedPaths = [
    '/sdcard/',
    '/storage/emulated/0/',
    '/data/local/tmp/'
  ];
  
  if (!allowedPaths.some(p => devicePath.startsWith(p))) {
    throw new Error(`Disallowed path: ${devicePath}`);
  }
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/[;$|&<>`\b]/g, '');
}

async function adbExec(args, input) {
  return new Promise((resolve, reject) => {
    const cmd = `adb ${args.join(' ')}`;
    const child = exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, 
      (err, stdout, stderr) => {
        if (err) reject(stderr || err.message);
        else resolve(stdout);
      }
    );
    
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

async function adbShell(cmd) {
  return adbExec(['shell', sanitizeInput(cmd)]);
}

async function runCommand(action, args) {
  try {
    switch (action) {
      // Fixed input actions
      case 'tap':
        if (typeof args.x !== 'number' || typeof args.y !== 'number') {
          throw new Error('Invalid coordinates');
        }
        return adbShell(`input tap ${args.x} ${args.y}`);
      
      case 'swipe':
        if ([args.x1, args.y1, args.x2, args.y2].some(isNaN)) {
          throw new Error('Invalid swipe coordinates');
        }
        return adbShell(`input swipe ${args.x1} ${args.y1} ${args.x2} ${args.y2} ${args.duration || 300}`);
      
      case 'keyevent':
        return adbShell(`input keyevent ${sanitizeInput(args.code)}`);
      
      case 'screenshot': {
        const out = await adbExec(['exec-out', 'screencap', '-p']);
        return Buffer.from(out, 'binary').toString('base64');
      }
      
      // Fixed file operations
      case 'installApk': {
        const tmpFile = path.join(TEMP_DIR, `app_${Date.now()}.apk`);
        await fs.writeFile(tmpFile, Buffer.from(args.file, 'base64'));
        try {
          await adbExec(['install', '-r', tmpFile]);
          return 'Installed';
        } finally {
          await fs.unlink(tmpFile);
        }
      }
      
      case 'installApkFromUrl': {
        const tmpFile = path.join(TEMP_DIR, `remote_${Date.now()}.apk`);
        const download = await fetch(args.url);
        const buffer = Buffer.from(await download.arrayBuffer());
        await fs.writeFile(tmpFile, buffer);
        try {
          await adbExec(['install', '-r', tmpFile]);
          return 'Installed';
        } finally {
          await fs.unlink(tmpFile);
        }
      }
      
      case 'pushFile': {
        validatePath(args.dest);
        const tmpFile = path.join(TEMP_DIR, `push_${Date.now()}`);
        await fs.writeFile(tmpFile, Buffer.from(args.file, 'base64'));
        try {
          await adbExec(['push', tmpFile, args.dest]);
          return 'Pushed';
        } finally {
          await fs.unlink(tmpFile);
        }
      }
      
      case 'pullFile': {
        validatePath(args.path);
        const tmpFile = path.join(TEMP_DIR, `pull_${Date.now()}`);
        await adbExec(['pull', args.path, tmpFile]);
        const data = await fs.readFile(tmpFile);
        await fs.unlink(tmpFile);
        return data.toString('base64');
      }
      
      case 'listDir': {
        validatePath(args.path);
        return adbShell(`ls -l ${args.path}`);
      }
      
      // Fixed recording actions
      case 'startRecording': {
        const out = await adbShell('screenrecord /sdcard/record.mp4 > /dev/null 2>&1 & echo $!');
        recordingPID = out.trim();
        return `Recording started (PID: ${recordingPID})`;
      }
      
      case 'stopRecording': {
        if (!recordingPID) throw new Error('No active recording');
        await adbShell(`kill -INT ${recordingPID}`);
        await new Promise(r => setTimeout(r, 2000)); // Allow file finalization
        recordingPID = null;
        return this.runCommand('pullFile', { path: '/sdcard/record.mp4' });
      }
      
      // Enhanced app management
      case 'listInstalledApps': {
        const out = await adbExec(['shell', 'pm', 'list', 'packages', '-f']);
        return out.split('\n').filter(Boolean).map(line => {
          const match = line.match(/^package:(.*?)=(.+)$/);
          return match ? { apk: match[1], package: match[2] } : null;
        }).filter(Boolean);
      }
      
      case 'uninstallApp':
        return adbExec(['uninstall', sanitizeInput(args.pkg)]);
      
      case 'switchLauncher':
        await adbShell(`am start -a android.intent.action.MAIN -c android.intent.category.HOME -n ${sanitizeInput(args.pkg)}/.Launcher`);
        return 'Launcher changed';
      
      // ===== NEW ACTIONS ===== //
      // 1. Device Control
      case 'reboot': 
        return adbExec(['reboot']);
      
      case 'batteryLevel': {
        const out = await adbShell('dumpsys battery');
        const levelMatch = out.match(/level:\s+(\d+)/);
        return levelMatch ? parseInt(levelMatch[1]) : -1;
      }
      
      // 2. Advanced Input
      case 'longPress':
        return adbShell(`input swipe ${args.x} ${args.y} ${args.x} ${args.y} ${args.duration || 1000}`);
      
      case 'inputText':
        return adbShell(`input text "${sanitizeInput(args.text)}"`);
      
      // 3. App Management
      case 'startApp':
        return adbShell(`monkey -p ${sanitizeInput(args.package)} 1`);
      
      case 'clearAppData':
        return adbShell(`pm clear ${sanitizeInput(args.package)}`);
      
      // 4. System Info
      case 'getProp':
        return adbShell(`getprop ${sanitizeInput(args.prop)}`);
      
      case 'networkStatus': {
        const [wifi, data] = await Promise.all([
          adbShell('dumpsys wifi | grep "Wi-Fi is"'),
          adbShell('dumpsys telephony.registry | grep "mDataConnectionState"')
        ]);
        return { 
          wifi: wifi.includes('enabled'), 
          mobileData: data.includes('2') 
        };
      }
      
      // 5. File Operations
      case 'deleteFile': {
        validatePath(args.path);
        return adbShell(`rm "${sanitizeInput(args.path)}"`);
      }
      
      case 'fileInfo': {
        validatePath(args.path);
        const res = await adbShell(`ls -l "${sanitizeInput(args.path)}"`);
        const [perms, , owner, size, date, time, ...nameParts] = res.trim().split(/\s+/);
        return {
          permissions: perms,
          owner,
          size: parseInt(size),
          modified: `${date} ${time}`,
          name: nameParts.join(' ')
        };
      }
      
      // 6. Advanced Debugging
      case 'uiDump': {
        const dumpPath = '/sdcard/ui.xml';
        await adbShell(`uiautomator dump ${dumpPath}`);
        return this.runCommand('pullFile', { path: dumpPath });
      }
      
      case 'takeBugReport': {
        const zipPath = path.join(TEMP_DIR, `bugreport_${Date.now()}.zip`);
        await adbExec(['bugreport', zipPath]);
        const data = await fs.readFile(zipPath);
        await fs.unlink(zipPath);
        return data.toString('base64');
      }
      
      // 7. Settings Modification
      case 'putSetting':
        return adbShell(`settings put ${sanitizeInput(args.namespace)} ${sanitizeInput(args.key)} ${sanitizeInput(args.value)}`);
      
      // 8. Permissions Management
      case 'grantPermission':
        return adbShell(`pm grant ${sanitizeInput(args.package)} ${sanitizeInput(args.permission)}`);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(`Action ${action} failed: ${error.message}`);
  }
}

wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    let payload;
    try { 
      payload = JSON.parse(msg.toString());
    } catch (e) { 
      return ws.send(JSON.stringify({ 
        status: 'error', 
        error: 'Invalid JSON payload' 
      }));
    }
    
    const { action, args, requestId } = payload;
    
    try {
      const result = await runWithTimeout(
        runCommand(action, args || {}),
        15000  // 15-second timeout
      );
      ws.send(JSON.stringify({ 
        requestId, 
        action, 
        status: 'ok', 
        data: result 
      }));
    } catch (err) {
      ws.send(JSON.stringify({ 
        requestId, 
        action, 
        status: 'error', 
        error: err.toString() 
      }));
    }
  });
});

console.log("Android Pod Agent running on ws://localhost:8081");
