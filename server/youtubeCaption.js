const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function fetchYouTubeCaptions(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const tmpBase = path.join(os.tmpdir(), `yt-subs-${Date.now()}`);

  return new Promise((resolve, reject) => {
    const args = [
      '--skip-download',
      '--write-auto-subs',
      '--write-subs',
      '--sub-lang', 'en',
      '--sub-format', 'vtt',
      '--convert-subs', 'vtt',
      '-o', tmpBase,
      url,
    ];

    execFile('yt-dlp', args, { timeout: 30000 }, (error, stdout, stderr) => {
      const possibleFiles = [
        `${tmpBase}.en.vtt`,
        `${tmpBase}.en-orig.vtt`,
      ];

      let subtitleFile = null;
      for (const f of possibleFiles) {
        if (fs.existsSync(f)) {
          subtitleFile = f;
          break;
        }
      }

      if (!subtitleFile) {
        const dir = path.dirname(tmpBase);
        const base = path.basename(tmpBase);
        try {
          const files = fs.readdirSync(dir);
          const match = files.find(f => f.startsWith(base) && f.endsWith('.vtt'));
          if (match) subtitleFile = path.join(dir, match);
        } catch {}
      }

      if (!subtitleFile) {
        reject(new Error('No English captions or subtitles found.'));
        return;
      }

      try {
        const vttContent = fs.readFileSync(subtitleFile, 'utf-8');
        const text = parseVtt(vttContent);
        fs.unlinkSync(subtitleFile);

        if (!text || text.trim().length < 50) {
          reject(new Error('Captions were empty.'));
          return;
        }

        resolve(text);
      } catch (err) {
        try { fs.unlinkSync(subtitleFile); } catch {}
        reject(err);
      }
    });
  });
}

function parseVtt(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  const seen = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT') continue;
    if (trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) continue;
    if (trimmed.startsWith('NOTE')) continue;
    if (/^\d{2}:\d{2}/.test(trimmed) && trimmed.includes('-->')) continue;
    if (/^[\d:.]+\s*$/.test(trimmed)) continue;

    const cleaned = trimmed
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      textLines.push(cleaned);
    }
  }

  return textLines.join(' ');
}

module.exports = { fetchYouTubeCaptions };
