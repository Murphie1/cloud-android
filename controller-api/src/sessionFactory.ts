import fs from 'fs/promises';
import mustache from 'mustache';
import { k8sApi } from './k8sClient';

export async function createSession(sessionId: string, os: string, resolution = '1280x720', memoryLimits = '4Gi', memoryRequests = '2Gi', cpuLimits = '2', cpuRequests = '1') {
  const path = `../${os}.yaml`;
  const rawTemplate = await fs.readFile(path, 'utf-8');

  const yaml = mustache.render(rawTemplate, {
    sessionId,
    resolution,
    memoryLimits,
    memoryRequests,
    cpuLimits,
    cpuRequests,
  });

  await k8sApi.createNamespacedDeployment({
    namespace: 'default', 
    body: yamlToPodObject(yaml)
  });
}

function yamlToPodObject(yaml: string): any {
  const YAML = require('js-yaml');
  return YAML.load(yaml);
}
