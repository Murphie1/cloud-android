import { WebSocketServer } from 'ws';
import { exec, spawn } from 'child_process';
import fs from 'fs/promises';

const wss = new WebSocketServer({ port: 8081 }); // pod agent WebSocket

function adbExec(args) {
  return new Promise((resolve, reject) => {
    exec(`adb ${args.join(' ')}`, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) reject(stderr || err.message);
      else resolve(stdout);
    });
  });
}

async function adbShell(cmd) {
  return adbExec(['shell', cmd]);
}

async function runCommand(action, args) {
  switch (action) {
    case 'tap':
      return adbShell(`input tap ${args.x} ${args.y}`);
    case 'swipe':
      return adbShell(`input swipe ${args.x1} ${args.y1} ${args.x2} ${args.y2}`);
    case 'keyevent':
      return adbShell(`input keyevent ${args.code}`);
    case 'screenshot': {
      const out = await adbExec(['exec-out', 'screencap', '-p']);
      return Buffer.from(out, 'binary').toString('base64');
    }
    case 'installApk': {
      await fs.writeFile('/data/local/tmp/app.apk', Buffer.from(args.file, 'base64'));
      return adbExec(['install', '-r', '/data/local/tmp/app.apk']);
    }
    case 'installApkFromUrl':
      return adbShell(`wget -O /data/local/tmp/remote.apk '${args.url}' && adb install -r /data/local/tmp/remote.apk`);
    case 'pushFile': {
      await fs.writeFile(args.dest, Buffer.from(args.file, 'base64'));
      return 'OK';
    }
    case 'pullFile': {
      const data = await fs.readFile(args.path);
      return data.toString('base64');
    }
    case 'listDir':
      return adbShell(`ls -l ${args.path}`);
    case 'listInstalledApps': {
      const out = await adbExec(['shell', 'pm', 'list', 'packages', '-f']);
      return out.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^package:(.*?)=(.+)$/);
        return match ? { apk: match[1], package: match[2] } : null;
      }).filter(Boolean);
    }
    case 'uninstallApp':
      return adbExec(['uninstall', args.pkg]);
    case 'startRecording':
      return adbShell(`screenrecord /sdcard/record.mp4 &`);
    case 'stopRecording': {
      await adbShell(`pkill -INT screenrecord`);
      await new Promise(r => setTimeout(r, 1000));
      const data = await fs.readFile('/sdcard/record.mp4');
      return data.toString('base64');
    }
    case 'switchLauncher':
      await adbShell(`pm clear com.android.launcher3`);
      return adbShell(`am start -a android.intent.action.MAIN -c android.intent.category.HOME -n ${args.pkg}/.Launcher`);
    default:
      throw new Error('Unknown action');
  }
}

wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    let payload;
    try { payload = JSON.parse(msg.toString()); } catch { return; }
    const { action, args, requestId } = payload;

    try {
      const result = await runCommand(action, args || {});
      ws.send(JSON.stringify({ requestId, action, status: 'ok', data: result }));
    } catch (err) {
      ws.send(JSON.stringify({ requestId, action, status: 'error', error: err.toString() }));
    }
  });
});

console.log("Pod WebSocket agent running on :8081");
