import { createProxyServer } from 'http-proxy';
import http from 'http';
import { coreV1 } from './k8sClient';

const proxy = createProxyServer({ ws: true });

export async function proxyScrcpy(req: http.IncomingMessage, socket: any, head: any, sessionId: string) {
  const labelSelector = `session=${sessionId}`;
  const pods = await coreV1.listNamespacedPod({
    namespace: 'default', 
    pretty: undefined,
    allowWatchBookmarks: undefined,
    _continue: undefined,
    fieldSelector: undefined,
    labelSelector,
  });
  const pod = pods.body.items[0];
  if (!pod) return socket.destroy();

  const ip = pod.status?.podIP;
  const target = `ws://${ip}:8080`;
  proxy.ws(req, socket, head, { target });
}
