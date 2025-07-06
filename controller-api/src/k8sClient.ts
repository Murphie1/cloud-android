import k8s from '@kubernetes/client-node';
import { Exec } from '@kubernetes/client-node';
import stream from 'stream';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export const exec = new Exec();
export const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
export const coreV1 = kc.makeApiClient(k8s.CoreV1Api);

// Exec utility
export async function execToPod(
  podName: string,
  cmd: string[],
  namespace = 'default',
  container = 'android-x86-vm'
): Promise<{ stdout: string, stderr: string }> {
  const stdout = new stream.PassThrough();
  const stderr = new stream.PassThrough();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  stdout.on('data', (chunk) => stdoutChunks.push(chunk));
  stderr.on('data', (chunk) => stderrChunks.push(chunk));

  await exec.exec(namespace, podName, container, cmd, stdout, stderr, null, false);

  return {
    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
    stderr: Buffer.concat(stderrChunks).toString('utf-8'),
  };
}

// Lookup pod from Deployment label
export async function getPodNameFromSession(sessionId: string): Promise<string> {
  const res = await coreV1.listNamespacedPod({
    namespace: 'default', 
    pretty: undefined, 
    allowWatchBookmarks: undefined,
    _continue: undefined,
    fieldSelector: undefined, 
    labelSelector: `session=${sessionId}`
  });
  const pods = res.body.items;
  if (!pods.length) throw new Error(`No pod found for session ${sessionId}`);
  return pods[0].metadata?.name!;
}
