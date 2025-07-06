import fs from 'fs';
import YAML from 'yaml';
import { k8sApi } from './k8sClient';
import { coreV1 } from './k8sClient';
import { execToPod } from './k8sClient';

const template = fs.readFileSync('../android-template.yaml', 'utf8');

export async function createSession(sessionId: string) {
  const filled = template.replace(/{{SESSION_ID}}/g, sessionId);
  const deployment = YAML.parse(filled);

  await k8sApi.createNamespacedDeployment({
    namespace: 'default', 
    body: deployment
  });
}

export async function deleteSession(sessionId: string) {
  await k8sApi.deleteNamespacedDeployment({
    name: `android-vm-${sessionId}`,
    namespace: 'default'
  });
}

export async function getSessionStatus(sessionId: string) {
  const labelSelector = `session=${sessionId}`;
  const res = await coreV1.listNamespacedDeployment({
    namespace: 'default', 
    pretty: undefined,
    allowWatchBookmarks: undefined,
    _continue: undefined,
    fieldSelector: undefined,
    labelSelector,
  });

  if (res.body.items.length === 0) {
    return { exists: false, ready: false };
  }

  const pod = res.body.items[0];
  const conditions = pod.status?.conditions || [];
  const ready = conditions.some(c => c.type === 'Ready' && c.status === 'True');

  return {
    exists: true,
    podName: pod.metadata?.name,
    phase: pod.status?.phase,
    ready
  };
}

export async function runAdbShell(sessionId: string, shellCmd: string) {
  const labelSelector = `session=${sessionId}`;
  const res = await coreV1.listNamespacedDeployment({
    namespace: 'default', 
    pretty: undefined,
    allowWatchBookmarks: undefined,
    _continue: undefined,
    fieldSelector: undefined,
    labelSelector,
  });
  
  const pod = res.body.items[0];
  if (!pod?.metadata?.name) throw new Error('Pod not found');

  const adbCmd = ['adb', 'shell', shellCmd];
  return await execToPod(pod.metadata.name, adbCmd);
}

export async function tap(sessionId: string, x: number, y: number) {
  return await runAdbShell(sessionId, `input tap ${x} ${y}`);
}

export async function swipe(sessionId: string, x1: number, y1: number, x2: number, y2: number) {
  return await runAdbShell(sessionId, `input swipe ${x1} ${y1} ${x2} ${y2}`);
}

export async function keyevent(sessionId: string, code: number) {
  return await runAdbShell(sessionId, `input keyevent ${code}`);
}

export async function screenshot(sessionId: string) {
  const result = await runAdbShell(sessionId, `screencap -p`);
  return result.stdout; // PNG base64 or binary (depending on handling)
}

export async function installApk(sessionId: string, podName: string, localPath: string) {
  // Copy to Android VM path
  const apkDest = `/data/local/tmp/uploaded.apk`;

  const copyCmd = [
    'sh', '-c',
    `cat > ${apkDest}`
  ];

  const fileBuffer = await fs.readFile(localPath);
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  await execToPod(podName, copyCmd, 'default', fileBuffer);

  // Install the APK
  const result = await execToPod(podName, ['adb', 'install', '-r', apkDest]);
  return result;
}

export async function installApkFromUrl(sessionId: string, url: string, podName: string) {
  const cmd = [
    'sh', '-c',
    `wget -O /data/local/tmp/remote.apk '${url}' && adb install -r /data/local/tmp/remote.apk`
  ];
  return await execToPod(podName, cmd);
}

export async function pushFile(sessionId: string, podName: string, destPath: string, fileBuffer: Buffer) {
  const cmd = ['sh', '-c', `cat > '${destPath}'`];
  return await execToPod(podName, cmd, 'default', fileBuffer);
}

export async function pullFile(sessionId: string, podName: string, path: string): Promise<Buffer> {
  const stdout: Buffer[] = [];
  const exec = new Exec();
  const stream = new stream.PassThrough();

  stream.on('data', (chunk) => stdout.push(chunk));

  await exec.exec('default', podName, 'android-vm', ['cat', path], stream, process.stderr, null, false);
  return Buffer.concat(stdout);
}

export async function listDir(sessionId: string, podName: string, path: string) {
  const cmd = ['ls', '-l', path];
  return await execToPod(podName, cmd);
}

export async function listInstalledApps(sessionId: string, podName: string) {
  const result = await execToPod(podName, ['adb', 'shell', 'pm', 'list', 'packages', '-f']);
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const match = line.match(/package:(.+\\.apk)=(.+)/);
      return match ? { apk: match[1], package: match[2] } : null;
    })
    .filter(Boolean);
}

export async function uninstallApp(sessionId: string, podName: string, pkg: string) {
  return await execToPod(podName, ['adb', 'uninstall', pkg]);
}

export async function startRecording(sessionId: string, podName: string) {
  const cmd = ['adb', 'shell', 'screenrecord', '/sdcard/record.mp4'];
  // Detach in background using sh
  return await execToPod(podName, ['sh', '-c', `${cmd.join(' ')} &`]);
}

export async function stopRecording(sessionId: string, podName: string): Promise<Buffer> {
  await execToPod(podName, ['adb', 'shell', 'pkill', '-INT', 'screenrecord']);
  await new Promise(r => setTimeout(r, 1000)); // wait for write

  return await pullFile(sessionId, podName, '/sdcard/record.mp4');
}

export async function switchLauncher(sessionId: string, podName: string, launcherPkg: string) {
  // Clear default launcher
  await execToPod(podName, ['adb', 'shell', 'pm', 'clear', 'com.android.launcher3']);

  // Start the new launcher
  const cmd = [
    'adb', 'shell',
    'am', 'start',
    '-a', 'android.intent.action.MAIN',
    '-c', 'android.intent.category.HOME',
    '-n', `${launcherPkg}/.Launcher` // fallback: just package if exact name unknown
  ];

  const result = await execToPod(podName, cmd);
  return result;
}
