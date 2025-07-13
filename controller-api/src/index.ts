import express, { Request, Response, RequestHandler, NextFunction } from 'express';
import { createSession } from "./sessionFactory.js";
import { 
  deleteSession, 
  getSessionStatus,
  runAdbShell,
  tap, 
  swipe, 
  keyevent,
  screenshot,
  installApk,
  installApkFromUrl, 
  switchLauncher,
  listInstalledApps,
  uninstallApp,
  startRecording,
  stopRecording,
  pullFile,
  pushFile,
  listDir,
} from './podManager.js';
import fs from "fs"
import http from 'http';
import { proxyScrcpy } from './streamProxy.js';
import multer from 'multer';



const app = express();
app.use(express.json());

const server = http.createServer(app);
const upload = multer({ dest: '/tmp' });

server.on('upgrade', async (req, socket, head) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const match = url.pathname?.match(/^\/session\/(.+)\/scrcpy$/);
  //const match = url.pathname?.match(/^\\/session\\/(.+)\\/scrcpy$/);
  if (match) {
    const sessionId = match[1];
    await proxyScrcpy(req, socket, head, sessionId);
  } else {
    socket.destroy();
  }
});

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
    (req, res, next) =>
        fn(req, res, next).catch(next);


app.post('/session', async (req, res) => {
  const { sessionId, resolution, memoryLimits, os, cpuLimits, memoryRequests, cpuRequests } = req.body;
  await createSession(sessionId, os, resolution, memoryLimits, memoryRequests, cpuLimits, cpuRequests);
  res.json({ sessionId });
});

app.delete('/session/:id', async (req, res) => {
  await deleteSession(req.params.id);
  res.sendStatus(204);
});

app.get('/session/:id/status', async (req, res) => {
  try {
    const status = await getSessionStatus(req.params.id);
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

app.post('/session/:id/exec', asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const { cmd } = req.body;

  if (!cmd || typeof cmd !== 'string') {
    return res.status(400).json({ error: 'Missing "cmd" in request body' });
  }

  try {
    const result = await runAdbShell(sessionId, cmd);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}));

app.post('/session/:id/input/tap', asyncHandler(async (req, res) => {
  const { x, y } = req.body;
  if (typeof x !== 'number' || typeof y !== 'number')
    return res.status(400).json({ error: 'x and y must be numbers' });

  const result = await tap(req.params.id, x, y);
  res.json(result);
}));

app.post('/session/:id/input/swipe', asyncHandler(async (req, res) => {
  const { x1, y1, x2, y2 } = req.body;
  const valid = [x1, y1, x2, y2].every(n => typeof n === 'number');
  if (!valid) return res.status(400).json({ error: 'All coords must be numbers' });

  const result = await swipe(req.params.id, x1, y1, x2, y2);
  res.json(result);
}));

app.post('/session/:id/input/key', asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (typeof code !== 'number') return res.status(400).json({ error: 'Keycode must be a number' });

  const result = await keyevent(req.params.id, code);
  res.json(result);
}));

app.get('/session/:id/screenshot', async (req, res) => {
  const pngData = await screenshot(req.params.id);
  const buffer = Buffer.from(pngData, 'binary');
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

app.post('/session/:id/install', upload.single('apk'), asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);

  if (!status.exists || !status.podName)
    return res.status(404).json({ error: 'Session not found' });

  try {
    // ✅ FIX: Use req.file (from multer), not req.body.file
    if (req.file) {
      const container = req.body.container ?? 'android-vm'; // fallback
      const result = await installApk(sessionId, status.podName, container, req.file.path);
      res.json(result);
    } else if (req.body.url) {
      const result = await installApkFromUrl(sessionId, req.body.url, status.podName);
      res.json(result);
    } else {
      res.status(400).json({ error: 'No file or URL provided' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

app.post('/session/:id/files/push', upload.single('file'), asyncHandler(async (req, res) => {
  const { path, container } = req.body;
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);

  if (!status.exists || !status.podName)
    return res.status(404).json({ error: 'Session not found' });

  if (!req.file || !path)
    return res.status(400).json({ error: 'Missing file or path' });

  // ✅ FIX: Use fs.promises.readFile for async/await
  const buf = await fs.promises.readFile(req.file.path);

  const result = await pushFile(sessionId, status.podName, container ?? 'android-vm', path, buf);
  res.json(result);
}));


app.get('/session/:id/files/list', async (req, res) => {
  const { path } = req.query;
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);

  const result = await listDir(sessionId, status.podName!, path as string);
  res.json({ output: result.stdout });
});

app.get('/session/:id/files/pull', asyncHandler(async (req, res) => {
  const { path } = req.query;
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);

  if (!status.exists || !status.podName)
    return res.status(404).json({ error: 'Session not found' });

  const buf = await pullFile(sessionId, status.podName, path as string);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(buf);
}));

app.get('/session/:id/apps', asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);

  if (!status.exists || !status.podName)
    return res.status(404).json({ error: 'Session not found' });

  const result = await listInstalledApps(sessionId, status.podName);
  res.json(result);
}));

app.delete('/session/:id/apps/:pkg', async (req, res) => {
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);
  const result = await uninstallApp(sessionId, status.podName!, req.params.pkg);
  res.json(result);
});


app.get('/session/:id/record/start', async (req, res) => {
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);
  await startRecording(sessionId, status.podName!);
  res.json({ started: true });
});

app.get('/session/:id/record/stop', async (req, res) => {
  const sessionId = req.params.id;
  const status = await getSessionStatus(sessionId);
  const buffer = await stopRecording(sessionId, status.podName!);
  res.setHeader('Content-Type', 'video/mp4');
  res.send(buffer);
});

app.post('/session/:id/launcher', asyncHandler(async (req, res) => {
  const sessionId = req.params.id;
  const { package: launcherPkg } = req.body;

  if (!launcherPkg) return res.status(400).json({ error: "Missing launcher package name" });

  try {
    const status = await getSessionStatus(sessionId);
    const result = await switchLauncher(sessionId, status.podName!, launcherPkg);
    res.json({ switched: true, output: result.stdout });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

const port = process.env.PORT || 3000;
//app.listen(port, () => {
  //console.log(`Controller API running on http://localhost:${port}`);
//});
server.listen(port, () => {
  console.log(`Controller API running at http://localhost:${port}`);
});
