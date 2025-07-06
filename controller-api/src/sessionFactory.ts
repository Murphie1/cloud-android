import fs from 'fs/promises';
import mustache from 'mustache';
import { k8sApi } from './k8sClient';

export async function createSession(sessionId: string, os: string, resolution = '1280x720') {
  const path = `./os-templates/${os}.yaml`;
  const rawTemplate = await fs.readFile(path, 'utf-8');

  const yaml = mustache.render(rawTemplate, {
    sessionId,
    resolution
  });

  await k8sApi.createNamespacedPod({
    namespace: 'default', 
    body: yamlToPodObject(yaml)
  });
}

function yamlToPodObject(yaml: string): any {
  const YAML = require('js-yaml');
  return YAML.load(yaml);
}
