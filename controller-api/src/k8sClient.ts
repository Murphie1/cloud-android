import k8s from '@kubernetes/client-node';
import { Exec } from '@kubernetes/client-node';
import stream from 'stream';

const exec = new Exec();
const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // in-cluster or local ~/.kube/config

export async function execToPod(
  podName: string,
  cmd: string[],
  namespace = 'default'
): Promise<{ stdout: string, stderr: string }> {
  const stdout = new stream.PassThrough();
  const stderr = new stream.PassThrough();

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  stdout.on('data', (chunk) => stdoutChunks.push(chunk));
  stderr.on('data', (chunk) => stderrChunks.push(chunk));

  await exec.exec(
    namespace,
    podName,
    'android-vm', // container name
    cmd,
    stdout,
    stderr,
    null,
    false /* tty */
  );

  return {
    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
    stderr: Buffer.concat(stderrChunks).toString('utf-8'),
  };
}
export const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
export const coreV1 = kc.makeApiClient(k8s.CoreV1Api);
