import Fastify from "fastify";
import sensible from "fastify-sensible";
import { renderTemplate } from "./template.js";
import { applyResource } from "./kube.js";
import { sanitizeManifest } from "./sanitizer.js";

// 🔑 Helper to enforce AuthKey
function requireAuth(req: any, reply: any, done: any) {
  const authKey = req.headers["authkey"] || req.headers["auth-key"];
  if (!authKey || authKey !== process.env.AUTH_KEY) {
    reply.unauthorized("Invalid or missing AuthKey");
    return;
  }
  done();
}

async function buildServer() {
  const logger = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: { colorize: true }
      }
    }
  });

  logger.register(sensible);

  // Public health route
  logger.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  // --- Protected routes (require AuthKey) ---

  // Create pod
  logger.post("/start", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as any;
    if (!body || !body.template || !body.values || !body.values.POD_ID) {
      return reply.badRequest("Values, and values.POD_ID are required");
    }

    const templateName = `${body.template}.yaml`;
    const values = body.values;

    let docs;
    try {
      docs = await renderTemplate(templateName, values);
    } catch (err: any) {
      req.log.error(err);
      return reply.internalServerError(`Template render failed: ${err.message}`);
    }

    for (const doc of docs) {
      const s = sanitizeManifest(doc);
      if (!s.ok) {
        const res = JSON.stringify({ message: "Sanitizer rejected manifest", errors: s.errors });
        return reply.badRequest(res);
      }
    }

    const orderKinds = (d: any) => {
      const k = d.kind;
      if (k === "Namespace") return 0;
      if (["ConfigMap", "Secret", "ServiceAccount", "PersistentVolumeClaim"].includes(k)) return 1;
      if (["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(k)) return 2;
      if (k === "Service") return 3;
      if (k === "Ingress") return 4;
      return 5;
    };

    docs.sort((a, b) => orderKinds(a) - orderKinds(b));

    const results: any[] = [];
    for (const doc of docs) {
      try {
        const res = await applyResource(doc);
        results.push({ status: "applied", ...res });
      } catch (err: any) {
        req.log.error({ err }, "applyResource failed");
        return reply.internalServerError(
          JSON.stringify({
          message: `Failed to apply resource ${doc.kind}/${doc.metadata?.name}`,
          error: err.message,
          applied: results
        }));
      }
    }

    return { message: "All resources applied", applied: results };
  });

  logger.get("/sessions/:sessionId", { preHandler: requireAuth }, async (req, reply) => {
  const podId = (req.params as any).sessionId;
  if (!podId) return reply.badRequest("podId required");

  const namespace = "default";

  try {
    const k8s = await import("@kubernetes/client-node");
    const kc = new k8s.KubeConfig();
    if (process.env.KUBECONFIG) kc.loadFromFile(process.env.KUBECONFIG);
    else kc.loadFromDefault();

    const appsApi = kc.makeApiClient(k8s.AppsV1Api);
    const batchApi = kc.makeApiClient(k8s.BatchV1Api);
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const netApi = kc.makeApiClient(k8s.NetworkingV1Api);

    const names = {
      deployment: `android-${podId}`,
      service: `android-${podId}`,
      ingress: `android-${podId}-ingress`,
    };

    const result: any = {};

async function readResource(fn: () => Promise<any>, key: string) {
  try {
    const res = await fn();
    result[key] = res;
  } catch (err: any) {
    if (err.response?.code === 404) {
      result[key] = null;
    } else {
      result[key] = err?.message || 'Unknown error from this resource';
    }
  }
}
    await Promise.all([
      readResource(() => appsApi.readNamespacedDeployment({ name: names.deployment, namespace }), "deployment"),
      readResource(() => coreApi.readNamespacedService({ name: names.service, namespace }), "service"),
      readResource(() => netApi.readNamespacedIngress({ name: names.ingress, namespace }), "ingress"),
    ]);

    return result;
  } catch (err: any) {
    req.log.error(err);
    return reply.internalServerError(err.message);
  }
});

  // Get pod resources
  logger.get("/sessions/all", { preHandler: requireAuth }, async (req, reply) => {
    const ns = `default`;

    try {
      const k8s = await import("@kubernetes/client-node");
      const kc = new k8s.KubeConfig();
      if (process.env.KUBECONFIG) kc.loadFromFile(process.env.KUBECONFIG);
      else kc.loadFromDefault();

      const apps = kc.makeApiClient(k8s.AppsV1Api);
      const core = kc.makeApiClient(k8s.CoreV1Api);
      const net = kc.makeApiClient(k8s.NetworkingV1Api);

      const [deployRes, svcRes, ingRes, podsRes] = await Promise.allSettled([
        apps.listNamespacedDeployment({ namespace: ns }),
        core.listNamespacedService({ namespace: ns }),
        net.listNamespacedIngress({ namespace: ns }),
        core.listNamespacedPod({ namespace: ns })
      ]);

      const result: any = {};
      if (deployRes.status === "fulfilled") result.deployments = deployRes.value.items;
      if (svcRes.status === "fulfilled") result.services = svcRes.value.items;
      if (ingRes.status === "fulfilled") result.ingresses = ingRes.value.items;
      if (podsRes.status === "fulfilled") result.pods = podsRes.value.items;

      return result;
    } catch (err: any) {
      req.log.error(err);
      return reply.internalServerError(err.message);
    }
  });

logger.delete("/sessions/:sessionId", { preHandler: requireAuth }, async (req, reply) => {
  const sessionId = (req.params as any).sessionId;
  if (!sessionId) return reply.badRequest("Session Id required");

  const namespace = "default";
  const appName = "android";
  const name = `android-${sessionId}`;
  

  try {
    const k8s = await import("@kubernetes/client-node");
    const kc = new k8s.KubeConfig();
    if (process.env.KUBECONFIG) kc.loadFromFile(process.env.KUBECONFIG);
    else kc.loadFromDefault();

    const appsApi = kc.makeApiClient(k8s.AppsV1Api);
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const batchApi = kc.makeApiClient(k8s.BatchV1Api);
    const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

    // Delete Deployment
    try {
      await appsApi.deleteNamespacedDeployment({ name, namespace });
    } catch (err: any) {
      return reply.internalServerError(`Pod deletion failed: ${err?.message}`);
    }

    // Delete Service
    try {
      await coreApi.deleteNamespacedService({ name, namespace });
    } catch (err: any) {
      return reply.internalServerError(`Service deletion failed: ${err?.message}`);
    }

    // Delete Ingress
    try {
      await networkingApi.deleteNamespacedIngress({ name: `${name}-ingress`, namespace });
    } catch (err: any) {
      return reply.internalServerError(`Ingress deletion failed: ${err?.message}`);
    }

    return { message: "Pod deletion requested", sessionId, namespace };
  } catch (err: any) {
    req.log.error(err);
    return reply.internalServerError(err.message);
  }
});

  // Scale Deployment
  logger.post("/sessions/:sessionId/patch", { preHandler: requireAuth }, async (req, reply) => {
    const sessionId = (req.params as any).sessionId;
    const body = req.body as any;
    if (!body || typeof body.replicas !== "number") return reply.badRequest("replicas: number required");
    const namespace = `default`;

    try {
      const k8s = await import("@kubernetes/client-node");
      const kc = new k8s.KubeConfig();
      if (process.env.KUBECONFIG) kc.loadFromFile(process.env.KUBECONFIG);
      else kc.loadFromDefault();

      const apps = kc.makeApiClient(k8s.AppsV1Api);
      const name = body.name;
      if (!name) return reply.badRequest("name (deployment name) is required");

      const patch = [{ op: "replace", path: "/spec/replicas", value: body.replicas }];
      await apps.patchNamespacedDeployment({
        name,
        namespace,
        body: patch,
      },
      k8s.setHeaderOptions("Content-Type", k8s.PatchStrategy.JsonPatch)
    );
      return { message: "patched", name, replicas: body.replicas };
    } catch (err: any) {
      req.log.error(err);
      return reply.internalServerError(err.message);
    }
  });

  // Exec into pod
logger.post("/sessions/:sessionId/exec", { preHandler: requireAuth }, async (req, reply) => {
  const sessionId = (req.params as any).sessionId;
  const { command = ["sh"], container } = (req as any).body || {}; // default: sh shell

  if (!sessionId) return reply.badRequest("podId required");
  const ns = `default`;
  const name = `android-${sessionId}`;

  try {
    const k8s = await import("@kubernetes/client-node");
    const kc = new k8s.KubeConfig();
    if (process.env.KUBECONFIG) kc.loadFromFile(process.env.KUBECONFIG);
    else kc.loadFromDefault();

    const exec = new k8s.Exec(kc);

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      exec.exec(
        ns,
        name, // pod name
        container, // container name (optional, if multiple containers in pod)
        command, // command array: ["sh"], ["ls", "/app"], etc
        process.stdout, // stream (or custom)
        process.stderr,
        null, // stdin (can be set up for interactive mode)
        false, // tty
        (status: any) => {
          if (status.status !== "Success") {
            reject(new Error(status.message || "Exec failed"));
          } else {
            resolve({ stdout, stderr });
          }
        }
      ).catch(reject);

      // Capture output streams
      const stdoutStream = new (require("stream").Writable)({
        write(chunk: any, encoding: any, cb: any) {
          stdout += chunk.toString();
          cb();
        },
      });
      const stderrStream = new (require("stream").Writable)({
        write(chunk: any, encoding: any, cb: any) {
          stderr += chunk.toString();
          cb();
        },
      });

      exec.exec(
        ns,
        sessionId,
        container,
        command,
        stdoutStream,
        stderrStream,
        null,
        false,
        (status: any) => {
          if (status.status !== "Success") {
            reject(new Error(status.message || "Exec failed"));
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });
  } catch (err: any) {
    req.log.error(err);
    return reply.internalServerError(err.message);
  }
});

  // Pod logs
  logger.get("/sessions/:sessionId/logs", { preHandler: requireAuth }, async (req, reply) => {
    const sessionId = (req.params as any).sessionId;
    const namespace = `default`;
    const podName = (req as any).query.podName as string | undefined;

    if (!podName) return reply.badRequest("podName query param required (pod name to stream logs from)");
    try {
      const k8s = await import("@kubernetes/client-node");
      const kc = new k8s.KubeConfig();
      if (process.env.KUBECONFIG) kc.loadFromFile(process.env.KUBECONFIG);
      else kc.loadFromDefault();
      const core = kc.makeApiClient(k8s.CoreV1Api);
      const logs = await core.readNamespacedPodLog({
        name: podName,
        namespace,
        follow: false,
        limitBytes: 1000,
        timestamps: true
    });
      return { logs };
    } catch (err: any) {
      req.log.error(err);
      return reply.internalServerError(err.message);
    }
  });

  return logger;
}

if (require.main === module) {
  (async () => {
    const server = await buildServer();
    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    server.listen({ port, host: "0.0.0.0" }, (err, address) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
      server.log.info(`Server listening at ${address}`);
    });
  })();
}

export default buildServer;
