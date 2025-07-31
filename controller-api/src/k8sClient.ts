import http from 'http';
import { spawn } from 'child_process';
import httpProxy from 'http-proxy';

const { createProxyServer } = httpProxy;
const proxy = createProxyServer({ ws: true });

// Attach error handler once
proxy.on('error', (err, _req, _res, _target) => {
  console.error(`❌ Proxy error: ${err.message}`);
});

function runKubectl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('kubectl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `kubectl ${args.join(' ')} failed`));
    });
  });
}

export async function proxyScrcpy(
  req: http.IncomingMessage,
  socket: any,
  head: any,
  sessionId: string
) {
  try {
    // Get pod IP quickly with jsonpath
    const ip = await runKubectl([
      'get', 'pod',
      '-n', 'default',
      '-l', `session=${sessionId}`,
      '-o', 'jsonpath={.items[0].status.podIP}'
    ]);

    if (!ip) {
      console.warn(`❌ No running pod found for session ${sessionId}`);
      return socket.destroy();
    }

    const target = `ws://${ip}:8080`;
    console.log(`🔁 Proxying scrcpy for session ${sessionId} to ${target}`);
    proxy.ws(req, socket, head, { target });

  } catch (err: any) {
    console.error(`❌ Failed to proxy scrcpy: ${err.message}`);
    socket.destroy();
  }
}
