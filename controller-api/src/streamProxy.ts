import { createProxyServer } from 'http-proxy';
import http from 'http';
import { coreV1 } from './k8sClient.js';

const proxy = createProxyServer({ ws: true });

// ✅ Attach error handler once
proxy.on('error', (err, _req, _res, _target) => {
  console.error(`❌ Proxy error: ${err.message}`);
});

export async function proxyScrcpy(
  req: http.IncomingMessage,
  socket: any,
  head: any,
  sessionId: string
) {
  const labelSelector = `session=${sessionId}`;

  try {
    const res = await coreV1.listNamespacedPod({
      namespace: 'default',
      labelSelector
    });

    // ✅ Only pick Running pod with valid IP
    const pod = res.items.find(p => p.status?.phase === 'Running' && p.status?.podIP);

    if (!pod || !pod.status?.podIP) {
      console.warn(`❌ No running pod found for session ${sessionId}`);
      return socket.destroy();
    }

    const ip = pod.status.podIP;
    const target = `ws://${ip}:8080`;

    console.log(`🔁 Proxying scrcpy for session ${sessionId} to ${target}`);
    proxy.ws(req, socket, head, { target });

  } catch (err: any) {
    console.error(`❌ Failed to proxy scrcpy: ${err.message}`);
    socket.destroy();
  }
}
