import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import stream from "stream";

const namespace = 'default';

// Fast cache for session → podName
const podCache: Record<string, string> = {};

// Core helper to run kubectl
function runKubectl(args: string[], input?: Buffer): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('kubectl', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '', stderr = '';
    proc.stdout.on('data', chunk => stdout += chunk.toString());
    proc.stderr.on('data', chunk => stderr += chunk.toString());

    proc.on('close', code => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(stderr || `kubectl ${args.join(' ')} failed`));
    });

    if (input) proc.stdin.write(input);
    proc.stdin.end();
  });
}

// Get pod for session (cached for speed)
async function getPodName(sessionId: string): Promise<string> {
  if (podCache[sessionId]) return podCache[sessionId];

  const { stdout } = await runKubectl([
    'get', 'pod',
    '-n', namespace,
    '-l', `session=${sessionId}`,
    '-o', 'jsonpath={.items[0].metadata.name}'
  ]);

  if (!stdout) throw new Error('No pod found for session');
  podCache[sessionId] = stdout;
  return stdout;
}

// === Management ===
export async function deleteSession(sessionId: string) {
  await runKubectl(['delete', 'deployment', `android-vm-${sessionId}`, '-n', namespace]);
  delete podCache[sessionId];
}

export async function getSessionStatus(sessionId: string) {
  const { stdout } = await runKubectl([
    'get', 'pod',
    '-n', namespace,
    '-l', `session=${sessionId}`,
    '-o', 'jsonpath={.items[0].status.phase}'
  ]);

  if (!stdout) return { exists: false, ready: false };

  const phase = stdout;
  const ready = phase === 'Running';
  return { exists: true, podName: await getPodName(sessionId), phase, ready };
}

// === ADB / Android actions ===
async function adbExec(sessionId: string, adbArgs: string[]): Promise<string> {
  const pod = await getPodName(sessionId);
  const { stdout } = await runKubectl([
    'exec', pod, '-n', namespace, '--', 'adb', ...adbArgs
  ]);
  return stdout;
}

export async function runAdbShell(sessionId: string, shellCmd: string) {
  return adbExec(sessionId, ['shell', shellCmd]);
}

export async function tap(sessionId: string, x: number, y: number) {
  return runAdbShell(sessionId, `input tap ${x} ${y}`);
}

export async function swipe(sessionId: string, x1: number, y1: number, x2: number, y2: number) {
  return runAdbShell(sessionId, `input swipe ${x1} ${y1} ${x2} ${y2}`);
}

export async function keyevent(sessionId: string, code: number) {
  return runAdbShell(sessionId, `input keyevent ${code}`);
}

export async function screenshot(sessionId: string): Promise<Buffer> {
  const pod = await getPodName(sessionId);
  const { stdout } = await runKubectl(['exec', pod, '-n', namespace, '--', 'adb', 'shell', 'screencap', '-p']);
  return Buffer.from(stdout, 'binary');
}

// === APK / file management ===
export async function installApk(sessionId: string, localPath: string) {
  const pod = await getPodName(sessionId);
  const apkDest = '/data/local/tmp/uploaded.apk';
  const fileBuffer = await fs.promises.readFile(localPath);
  await runKubectl(['exec', pod, '-n', namespace, '--', 'sh', '-c', `cat > ${apkDest}`], fileBuffer);
  return adbExec(sessionId, ['install', '-r', apkDest]);
}

export async function installApkFromUrl(sessionId: string, url: string) {
  return runAdbShell(sessionId, `wget -O /data/local/tmp/remote.apk '${url}' && adb install -r /data/local/tmp/remote.apk`);
}

export async function pushFile(sessionId: string, destPath: string, fileBuffer: Buffer) {
  const pod = await getPodName(sessionId);
  await runKubectl(['exec', pod, '-n', namespace, '--', 'sh', '-c', `cat > '${destPath}'`], fileBuffer);
}

export async function pullFile(sessionId: string, filePath: string): Promise<Buffer> {
  const pod = await getPodName(sessionId);
  const { stdout } = await runKubectl(['exec', pod, '-n', namespace, '--', 'cat', filePath]);
  return Buffer.from(stdout, 'binary');
}

export async function listDir(sessionId: string, path: string) {
  return runAdbShell(sessionId, `ls -l ${path}`);
}

export async function listInstalledApps(sessionId: string) {
  const out = await adbExec(sessionId, ['shell', 'pm', 'list', 'packages', '-f']);
  return out.split('\n').filter(Boolean).map(line => {
    const match = line.match(/^package:(.*?)=(.+)$/);
    return match ? { apk: match[1], package: match[2] } : null;
  }).filter(Boolean);
}

export async function uninstallApp(sessionId: string, pkg: string) {
  return adbExec(sessionId, ['uninstall', pkg]);
}

// === Recording ===
export async function startRecording(sessionId: string) {
  return runAdbShell(sessionId, `screenrecord /sdcard/record.mp4 &`);
}

export async function stopRecording(sessionId: string): Promise<Buffer> {
  await runAdbShell(sessionId, `pkill -INT screenrecord`);
  await new Promise(r => setTimeout(r, 1000));
  return pullFile(sessionId, '/sdcard/record.mp4');
}

export async function switchLauncher(sessionId: string, launcherPkg: string) {
  await runAdbShell(sessionId, `pm clear com.android.launcher3`);
  return runAdbShell(sessionId, `am start -a android.intent.action.MAIN -c android.intent.category.HOME -n ${launcherPkg}/.Launcher`);
}
