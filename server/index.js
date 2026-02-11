const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { parseVideoToRecipe } = require('./parseVideo');

const app = express();
const PORT = 5000;
const METRO_PORT = 8080;

app.use(express.json());

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(
  '/',
  createProxyMiddleware({
    target: `http://127.0.0.1:${METRO_PORT}`,
    changeOrigin: true,
    ws: true,
    logLevel: 'warn',
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (proxying Metro on ${METRO_PORT})`);
});
