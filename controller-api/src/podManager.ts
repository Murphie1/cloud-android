import fs from 'fs';
import YAML from 'yaml';
import { k8sApi, exec } from './k8sClient';
import { coreV1 } from './k8sClient';
import { execToPod } from './k8sClient';
import stream from "stream"
import { ContainerStatus } from '@kubernetes/client-node';

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
  const res = await coreV1.listNamespacedPod({
    namespace: 'default', 
    labelSelector,
  });

  if (res.items.length === 0) {
    return { exists: false, ready: false };
  }

  // ✅ FIX: Choose a running pod if multiple exist (e.g., during restarts)
  const pod = res.items.find(p => p.status?.phase === 'Running') || res.items[0];

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
  const res = await coreV1.listNamespacedPod({
    namespace: 'default', 
    pretty: undefined,
    allowWatchBookmarks: undefined,
    _continue: undefined,
    fieldSelector: undefined,
    labelSelector,
  });
  
  const pod = res.items[0];
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

export async function installApk(sessionId: string, podName: string, container: string, localPath: string) {
  const apkDest = `/data/local/tmp/uploaded.apk`;
  const copyCmd = ['sh', '-c', `cat > ${apkDest}`];

  // ✅ FIX: Use fs.promises.readFile instead of incorrect callback+await usage
  const fileBuffer = await fs.promises.readFile(localPath);

  // ✅ FIX: Ensure namespace and container are passed
  await execToPod(podName, copyCmd, 'default', container, fileBuffer);

  // ✅ FIX: Ensure consistent usage of execToPod with namespace and container
  const result = await execToPod(podName, ['adb', 'install', '-r', apkDest], 'default', container);
  return result;
}

export async function installApkFromUrl(sessionId: string, url: string, podName: string) {
  const cmd = [
    'sh', '-c',
    `wget -O /data/local/tmp/remote.apk '${url}' && adb install -r /data/local/tmp/remote.apk`
  ];
  return await execToPod(podName, cmd);
}

export async function pushFile(sessionId: string, podName: string, container: string, destPath: string, fileBuffer: Buffer) {
  const cmd = ['sh', '-c', `cat > '${destPath}'`];
  return await execToPod(podName, cmd, 'default', container, fileBuffer);
}

export async function pullFile(sessionId: string, podName: string, path: string): Promise<Buffer> {
  const stdout: Buffer[] = [];
  const streams = new stream.PassThrough();

  streams.on('data', (chunk) => stdout.push(chunk));

  // ✅ FIX: Dynamically retrieve container name instead of hardcoding 'android-vm'
  const pod = await coreV1.readNamespacedPod(podName, 'default');
  const containerName = pod.body.spec?.containers?.[0]?.name || 'android-vm';

  await exec.exec('default', podName, containerName, ['cat', path], streams, process.stderr, null, false);

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
      // ✅ FIX: More robust regex to handle paths with special chars
      const match = line.match(/^package:(.*?)=(.+)$/);
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

// 🆕 Optional Helper: Reusable pod name fetcher
async function getPodNameForSession(sessionId: string): Promise<string> {
  const labelSelector = `session=${sessionId}`;
  const res = await coreV1.listNamespacedPod({ namespace: 'default', labelSelector });
  const pod = res.items.find(p => p.status?.phase === 'Running') || res.items[0];
  if (!pod?.metadata?.name) throw new Error('Pod not found for session');
  return pod.metadata.name;
}
