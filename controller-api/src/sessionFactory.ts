import fs from 'fs/promises';
import mustache from 'mustache';
import YAML from 'js-yaml';
import path from 'path';
import { k8sApi } from './k8sClient.js';

export async function createSession(
  sessionId: string,
  os: string,
  resolution = '1280x720',
  memoryLimits = '4Gi',
  memoryRequests = '2Gi',
  cpuLimits = '2',
  cpuRequests = '1'
) {
  try {
    const filePath = path.resolve(__dirname, `../${os}.yaml`);
    const rawTemplate = await fs.readFile(filePath, 'utf-8');

    const rendered = mustache.render(rawTemplate, {
      sessionId,
      resolution,
      memoryLimits,
      memoryRequests,
      cpuLimits,
      cpuRequests,
    });

    const deployment = YAML.load(rendered);
    if (!deployment || typeof deployment !== 'object') {
      throw new Error('Parsed YAML is invalid or empty');
    }

    await k8sApi.createNamespacedDeployment({
      namespace: 'default',
      body: deployment
    });
  } catch (err: any) {
    console.error(`❌ Failed to create session for "${sessionId}": ${err.message}`);
    throw err;
  }
}
