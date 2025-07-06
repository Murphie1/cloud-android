import fs from 'fs';
import YAML from 'yaml';
import { k8sApi } from './k8sClient';

const template = fs.readFileSync('./android-template.yaml', 'utf8');

export async function createSession(sessionId: string) {
  const filled = template.replace(/{{SESSION_ID}}/g, sessionId);
  const deployment = YAML.parse(filled);

  await k8sApi.createNamespacedDeployment('default', deployment);
}

export async function deleteSession(sessionId: string) {
  await k8sApi.deleteNamespacedDeployment(`android-vm-${sessionId}`, 'default');
}
