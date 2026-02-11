const express = require('express');
const cors = require('cors');
const { parseVideoToRecipe } = require('./parseVideo');

const app = express();
const PORT = 3001;

app.use(cors());
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video parser backend running on port ${PORT}`);
});
