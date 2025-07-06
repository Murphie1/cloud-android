import express from 'express';
import { 
  createSession, 
  deleteSession, 
  getSessionStatus,
  runAdbShell,
  tap, 
  swipe, 
  keyevent,
  screenshot,
} from './podManager';
import http from 'http';
import { proxyScrcpy } from './streamProxy';

const app = express();
app.use(express.json());

const server = http.createServer(app);

server.on('upgrade', async (req, socket, head) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const match = url.pathname?.match(/^\\/session\\/(.+)\\/scrcpy$/);
  if (match) {
    const sessionId = match[1];
    await proxyScrcpy(req, socket, head, sessionId);
  } else {
    socket.destroy();
  }
});

app.post('/session', async (req, res) => {
  const sessionId = generateSessionId();
  await createSession(sessionId);
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

app.post('/session/:id/exec', async (req, res) => {
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
});

app.post('/session/:id/input/tap', async (req, res) => {
  const { x, y } = req.body;
  if (typeof x !== 'number' || typeof y !== 'number')
    return res.status(400).json({ error: 'x and y must be numbers' });

  const result = await tap(req.params.id, x, y);
  res.json(result);
});

app.post('/session/:id/input/swipe', async (req, res) => {
  const { x1, y1, x2, y2 } = req.body;
  const valid = [x1, y1, x2, y2].every(n => typeof n === 'number');
  if (!valid) return res.status(400).json({ error: 'All coords must be numbers' });

  const result = await swipe(req.params.id, x1, y1, x2, y2);
  res.json(result);
});

app.post('/session/:id/input/key', async (req, res) => {
  const { code } = req.body;
  if (typeof code !== 'number') return res.status(400).json({ error: 'Keycode must be a number' });

  const result = await keyevent(req.params.id, code);
  res.json(result);
});

app.get('/session/:id/screenshot', async (req, res) => {
  const pngData = await screenshot(req.params.id);
  const buffer = Buffer.from(pngData, 'binary');
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});


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
