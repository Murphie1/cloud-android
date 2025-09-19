import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { proxyScrcpy } from './streamProxy';
import { getPodName, createSession, deleteSession } from './podManager';

// Define types for our data structures
interface ControllerMessage {
  action: string;
  sessionId?: string;
  payload?: Record<string, any>;
  requestId?: string;
}

interface AgentMessage {
  action: string;
  args?: Record<string, any>;
  requestId: string;
}

interface AgentResponse {
  requestId: string;
  status: string;
  [key: string]: any;
}

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

// List of all supported actions
const AGENT_ACTIONS = [
  'tap', 'swipe', 'keyevent', 'screenshot', 'installApk', 'installApkFromUrl',
  'pushFile', 'pullFile', 'listDir', 'listInstalledApps', 'uninstallApp',
  'startRecording', 'stopRecording', 'switchLauncher', 'reboot', 'batteryLevel',
  'longPress', 'inputText', 'startApp', 'clearAppData', 'getProp', 'networkStatus',
  'deleteFile', 'fileInfo', 'uiDump', 'takeBugReport', 'putSetting', 'grantPermission'
] as const;

// Handle WebSocket upgrade
server.on('upgrade', async (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/session\/(.+)\/scrcpy$/);
  
  if (match) {
    const sessionId = match[1];
    await proxyScrcpy(req, socket, head, sessionId);
  } else if (url.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Helper: Generate unique request IDs
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Helper: Connect to Pod Agent with timeout
async function connectToPodAgent(podName: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Agent connection timeout'));
    }, 5000);

    const ws = new WebSocket(`ws://${podName}:8081`);
    
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Core WebSocket Command Routing
wss.on('connection', (ws: WebSocket) => {
  console.log('Controller client connected');
  const agentConnections = new Map<string, WebSocket>();

  ws.on('close', () => {
    // Clean up any persistent agent connections
    agentConnections.forEach(agentWs => agentWs.close());
    agentConnections.clear();
  });

  ws.on('message', async (data: WebSocket.RawData) => {
    try {
      const message = JSON.parse(data.toString()) as ControllerMessage;
      const { action, sessionId, payload = {}, requestId = generateRequestId() } = message;

      if (!action) {
        return ws.send(JSON.stringify({ 
          requestId, 
          status: 'error', 
          error: 'Missing action' 
        }));
      }

      // Session management commands
      switch (action) {
        case 'createSession': {
          const id = sessionId || Math.random().toString(36).substring(2, 10);
          await createSession(id, payload?.os, payload?.resolution);
          return ws.send(JSON.stringify({ 
            requestId, 
            action, 
            sessionId: id, 
            status: 'created' 
          }));
        }
        
        case 'deleteSession': {
          if (!sessionId) {
            return ws.send(JSON.stringify({
              requestId,
              status: 'error',
              error: 'Missing sessionId for delete operation'
            }));
          }
          
          await deleteSession(sessionId);
          // Close any persistent connection to this pod
          if (agentConnections.has(sessionId)) {
            agentConnections.get(sessionId)?.close();
            agentConnections.delete(sessionId);
          }
          return ws.send(JSON.stringify({ 
            requestId, 
            action, 
            sessionId, 
            status: 'deleted' 
          }));
        }
      }

      // Agent commands
      try {
        if (!sessionId) {
          return ws.send(JSON.stringify({
            requestId,
            status: 'error',
            error: 'Missing sessionId for agent command'
          }));
        }
        
        const pod = await getPodName(sessionId);
        let agentWs: WebSocket;
        
        // Reuse connection if persistent flag is set
        if (payload?.persistent && agentConnections.has(sessionId)) {
          agentWs = agentConnections.get(sessionId)!;
        } else {
          agentWs = await connectToPodAgent(pod);
          if (payload?.persistent) {
            agentConnections.set(sessionId, agentWs);
          }
        }

        // Prepare agent message with proper structure
        const agentMsg: AgentMessage = {
          action,
          args: payload,
          requestId
        };

        // Handle agent responses
        const responseHandler = (msg: WebSocket.RawData) => {
          try {
            const response = JSON.parse(msg.toString()) as AgentResponse;
            if (response.requestId === requestId) {
              ws.send(JSON.stringify(response));
              agentWs.off('message', responseHandler);
              
              // Close temporary connections
              if (!payload?.persistent) {
                agentWs.close();
              }
            }
          } catch (e) {
            console.error('Error parsing agent response:', e);
          }
        };

        agentWs.on('message', responseHandler);
        agentWs.send(JSON.stringify(agentMsg));
        
      } catch (err) {
        const error = err as Error;
        ws.send(JSON.stringify({
          requestId,
          action,
          status: 'error',
          error: `Agent connection failed: ${error.message}`
        }));
      }

    } catch (err) {
      const error = err as Error;
      ws.send(JSON.stringify({
        status: 'error',
        error: `Processing error: ${error.message}`
      }));
    }
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(port, () => console.log(`Realtime controller running on :${port}`));
