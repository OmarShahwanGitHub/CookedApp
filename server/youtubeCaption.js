const https = require('https');
const http = require('http');

async function fetchYouTubeCaptions(videoId) {
  const pageHtml = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`);

  const captionTrackPattern = /"captionTracks":\s*(\[.*?\])/;
  const match = pageHtml.match(captionTrackPattern);

  if (!match) {
    throw new Error('No caption tracks found for this video.');
  }

  let tracks;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    throw new Error('Failed to parse caption track data.');
  }

  if (!tracks || tracks.length === 0) {
    throw new Error('No caption tracks available.');
  }

  let track = tracks.find(t => t.languageCode === 'en');
  if (!track) {
    track = tracks.find(t => t.languageCode && t.languageCode.startsWith('en'));
  }
  if (!track) {
    track = tracks[0];
  }

  if (!track.baseUrl) {
    throw new Error('Caption track has no URL.');
  }

  const captionUrl = track.baseUrl + '&fmt=srv3';
  const captionXml = await fetchUrl(captionUrl);

  const textSegments = [];
  const textPattern = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let textMatch;
  while ((textMatch = textPattern.exec(captionXml)) !== null) {
    let text = textMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    if (text) {
      textSegments.push(text);
    }
  }

  if (textSegments.length === 0) {
    throw new Error('Captions were empty.');
  }

  return textSegments.join(' ');
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { fetchYouTubeCaptions };
