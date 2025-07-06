import fs from 'fs';
import YAML from 'yaml';
import { k8sApi } from './k8sClient';
import { coreV1 } from './k8sClient';
import { execToPod } from './k8sClient';

const template = fs.readFileSync('./android-template.yaml', 'utf8');

export async function createSession(sessionId: string) {
  const filled = template.replace(/{{SESSION_ID}}/g, sessionId);
  const deployment = YAML.parse(filled);

  await k8sApi.createNamespacedDeployment('default', deployment);
}

export async function deleteSession(sessionId: string) {
  await k8sApi.deleteNamespacedDeployment(`android-vm-${sessionId}`, 'default');
}

export async function getSessionStatus(sessionId: string) {
  const labelSelector = `session=${sessionId}`;
  const res = await coreV1.listNamespacedPod('default', undefined, undefined, undefined, undefined, labelSelector);

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
  const res = await coreV1.listNamespacedPod('default', undefined, undefined, undefined, undefined, labelSelector);
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

