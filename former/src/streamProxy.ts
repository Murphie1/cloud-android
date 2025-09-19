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

{/*
  import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import { WebSocket } from 'ws';

// Define types for our data structures
type PodCacheEntry = {
  ip: string;
  timestamp: number;
};

type SocketPair = {
  client: net.Socket;
  device: net.Socket;
};

// In-cluster direct pod connection manager
const podConnections = new Map<string, SocketPair>();

// Enhanced Kubernetes API client with caching
export class K8sClient {
  private podCache: Map<string, PodCacheEntry>;
  private cacheTTL: number;

  constructor() {
    this.podCache = new Map();
    this.cacheTTL = 30000; // 30 seconds
  }

  async getPodIP(sessionId: string): Promise<string> {
    const cached = this.podCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.ip;
    }

    const ip = await this.fetchPodIP(sessionId);
    this.podCache.set(sessionId, { ip, timestamp: Date.now() });
    return ip;
  }

  private async fetchPodIP(sessionId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        'get', 'pod',
        '-n', 'default',
        '-l', `session=${sessionId}`,
        '-o', 'jsonpath={.items[0].status.podIP}'
      ];

      const proc: ChildProcess = spawn('kubectl', args, { 
        stdio: ['ignore', 'pipe', 'pipe'] 
      });
      
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (d: Buffer) => stdout += d.toString());
      proc.stderr?.on('data', (d: Buffer) => stderr += d.toString());

      proc.on('close', (code: number | null) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr || `Pod not found for session ${sessionId}`));
      });

      proc.on('error', (err: Error) => reject(err));
    });
  }
}

const k8sClient = new K8sClient();

export async function proxyScrcpy(
  req: http.IncomingMessage,
  socket: net.Socket,
  head: Buffer,
  sessionId: string
): Promise<void> {
  try {
    // Get pod IP from cache or API
    const podIP = await k8sClient.getPodIP(sessionId);
    if (!podIP) {
      console.warn(`❌ No running pod found for session ${sessionId}`);
      socket.destroy();
      return;
    }

    console.log(`🔁 Proxying scrcpy for ${sessionId} to ${podIP}:8080`);

    // Create direct TCP connection to pod
    const deviceSocket = new net.Socket();
    deviceSocket.connect(8080, podIP, () => {
      // Set TCP_NODELAY for reduced buffering
      deviceSocket.setNoDelay(true);
      socket.setNoDelay(true);

      // Write WebSocket upgrade headers
      deviceSocket.write(
        `GET / HTTP/1.1\r\n` +
        `Host: ${podIP}:8080\r\n` +
        `Connection: Upgrade\r\n` +
        `Upgrade: websocket\r\n` +
        `Sec-WebSocket-Key: ${req.headers['sec-websocket-key']}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `\r\n`
      );

      // Pipe remaining head buffer
      if (head && head.length) {
        deviceSocket.write(head);
      }

      // Setup bidirectional piping
      deviceSocket.pipe(socket);
      socket.pipe(deviceSocket);

      // Track active connections
      podConnections.set(sessionId, {
        client: socket,
        device: deviceSocket
      });
    });

    // Error handling
    deviceSocket.on('error', (err: Error) => {
      console.error(`Device socket error: ${err.message}`);
      podConnections.delete(sessionId);
      if (!socket.destroyed) socket.destroy();
    });

    socket.on('error', (err: Error) => {
      console.error(`Client socket error: ${err.message}`);
      podConnections.delete(sessionId);
      if (!deviceSocket.destroyed) deviceSocket.destroy();
    });

    // Cleanup on close
    socket.on('close', () => {
      podConnections.delete(sessionId);
      if (!deviceSocket.destroyed) deviceSocket.destroy();
    });

  } catch (err) {
    const error = err as Error;
    console.error(`❌ Failed to proxy scrcpy: ${error.message}`);
    podConnections.delete(sessionId);
    if (!socket.destroyed) socket.destroy();
  }
}

// Renamed to avoid conflict with 'ws' import
export function createOptimizedWebSocketStream(ws: WebSocket) {
  const stream = createWebSocketStream(ws, {
    encoding: 'binary',
    decodeStrings: false,
    defaultEncoding: 'binary' as BufferEncoding
  });
  
  stream.on('error', (err: Error) => 
    console.error('WebSocket stream error:', err));
  return stream;
}
  */}
