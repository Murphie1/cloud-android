import express from 'express';
import { createSession, deleteSession } from './podManager';

const app = express();
app.use(express.json());

app.post('/session', async (req, res) => {
  const sessionId = generateSessionId();
  await createSession(sessionId);
  res.json({ sessionId });
});

app.delete('/session/:id', async (req, res) => {
  await deleteSession(req.params.id);
  res.sendStatus(204);
});

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Controller API running on http://localhost:${port}`);
});
