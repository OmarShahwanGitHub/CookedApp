const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url === '/parse-video' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { url } = JSON.parse(body);
            if (!url || typeof url !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'A valid video URL is required.' }));
              return;
            }
            const { parseVideoToRecipe } = require('./server/parseVideo');
            const result = await parseVideoToRecipe(url.trim());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error('Video parse error:', err);
            const status = err.statusCode || 500;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Failed to process video.' }));
          }
        });
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
