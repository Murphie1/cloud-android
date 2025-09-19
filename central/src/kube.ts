import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
if (process.env.KUBECONFIG) {
  kc.loadFromFile(process.env.KUBECONFIG);
} else {
  kc.loadFromDefault();
}

export const coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
export const appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
export const batchV1Api = kc.makeApiClient(k8s.BatchV1Api);
export const networkingV1Api = kc.makeApiClient(k8s.NetworkingV1Api);
export const rbacAuthV1Api = kc.makeApiClient(k8s.RbacAuthorizationV1Api);

export async function applyResource(resource: any) {
  if (!resource?.kind || !resource?.apiVersion || !resource?.metadata) {
    throw new Error("Invalid Kubernetes resource (missing kind/apiVersion/metadata)");
  }

  const kind = resource.kind;
  const name = resource.metadata.name as string;
  const namespace = resource.metadata.namespace as string || "default";

  try {
    switch (kind) {
      case "Deployment":
        try {
          await appsV1Api.readNamespacedDeployment({ name, namespace });
          await appsV1Api.replaceNamespacedDeployment({ name, namespace, body: resource });
        } catch {
          await appsV1Api.createNamespacedDeployment({ namespace, body: resource });
        }
        break;

      case "Service":
        try {
          await coreV1Api.readNamespacedService({ name, namespace });
          await coreV1Api.replaceNamespacedService({ name, namespace, body: resource });
        } catch {
          await coreV1Api.createNamespacedService({ namespace, body: resource });
        }
        break;

      case "Ingress":
        try {
          await networkingV1Api.readNamespacedIngress({ name, namespace });
          await networkingV1Api.replaceNamespacedIngress({ name, namespace, body: resource });
        } catch {
          await networkingV1Api.createNamespacedIngress({ namespace, body: resource });
        }
        break;

      default:
        throw new Error(`Unsupported kind in applyResource: ${kind}`);
    }
  } catch (err) {
    throw new Error(`Failed to apply ${kind} ${name} in ${namespace}: ${(err as Error).message}`);
  }

  return { kind, name, namespace };
}
