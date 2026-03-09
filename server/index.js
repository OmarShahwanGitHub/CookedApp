const express = require('express');
const path = require('path');
const cors = require('cors');
const { parseVideoToRecipe } = require('./parseVideo');

const app = express();
const PORT = process.env.PORT || process.env.VIDEO_BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// Lifetime recipe count per user_id (survives app reinstall when client sends same stable ID)
const recipeCountByUser = new Map();

app.get('/recipe-count', (req, res) => {
  const userId = req.query.user_id;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'user_id query is required.' });
  }
  const count = recipeCountByUser.get(userId) || 0;
  return res.json({ count });
});

app.post('/recipe-count', (req, res) => {
  const { user_id: userId } = req.body || {};
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'user_id in body is required.' });
  }
  const prev = recipeCountByUser.get(userId) || 0;
  const next = prev + 1;
  recipeCountByUser.set(userId, next);
  return res.json({ count: next });
});

app.post('/parse-video', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid video URL is required.' });
  }

  try {
    const result = await parseVideoToRecipe(url.trim());
    return res.json(result);
  } catch (err) {
    console.error('Video parse error:', err);
    const message = err.message || 'Failed to process video.';
    const status = err.statusCode || 500;
    return res.status(status).json({ error: message });
  }
});

// Force-update: app checks this and blocks if installed version is below min.
// Set MIN_APP_VERSION when you release a breaking build (e.g. "1.1.0").
app.get('/app-version', (req, res) => {
  const min = process.env.MIN_APP_VERSION || '0.0.0';
  return res.json({ min_version: min });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Privacy and support pages (same deployment = more traffic, less spin-down)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video parser backend running on port ${PORT}`);
});
