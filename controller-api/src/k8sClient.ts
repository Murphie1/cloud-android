import k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // in-cluster or local ~/.kube/config

export const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
export const coreV1 = kc.makeApiClient(k8s.CoreV1Api);
