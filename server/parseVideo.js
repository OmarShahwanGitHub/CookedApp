/**
 * Video-to-recipe: YouTube via TranscriptAPI.com, other URLs via AssemblyAI.
 * No scraping, no yt-dlp, no ffmpeg, no cookies.
 */

const { parseTranscriptToRecipe } = require('./recipeParse');

const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2';
const TRANSCRIPTAPI_BASE = 'https://transcriptapi.com/api/v2';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const TRANSCRIPT_UNAVAILABLE_MSG = 'Transcript unavailable. Please paste recipe text manually.';

function isYouTubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function getAssemblyAIKey() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    const err = new Error('ASSEMBLYAI_API_KEY is not set.');
    err.statusCode = 500;
    throw err;
  }
  return key.trim();
}

function getTranscriptAPIKey() {
  const key = process.env.TRANSCRIPTAPI_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) return null;
  return key.trim();
}

function validateUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const err = new Error('Invalid URL format.');
    err.statusCode = 400;
    throw err;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const err = new Error('Only http and https URLs are supported.');
    err.statusCode = 400;
    throw err;
  }
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [/^localhost$/i, /^127\./i, /^10\./i, /^172\.(1[6-9]|2\d|3[01])\./i, /^192\.168\./i];
  for (const re of blocked) {
    if (re.test(hostname)) {
      const err = new Error('URLs pointing to internal or private addresses are not allowed.');
      err.statusCode = 400;
      throw err;
    }
  }
}

async function assemblyaiFetch(path, options = {}) {
  const apiKey = getAssemblyAIKey();
  const url = path.startsWith('http') ? path : `${ASSEMBLYAI_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = res.ok ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const message = typeof data === 'string' ? data : (data.error || data.status_message || res.statusText) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

async function submitTranscript(audioUrl) {
  const body = {
    audio_url: audioUrl,
    speech_models: ['universal-2', 'universal-1'],
  };
  const data = await assemblyaiFetch('/transcript', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!data.id) {
    const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
    err.statusCode = 422;
    throw err;
  }
  return data.id;
}

async function getTranscript(transcriptId) {
  const data = await assemblyaiFetch(`/transcript/${transcriptId}`);
  return { status: data.status, text: data.text, error: data.error };
}

async function waitForTranscript(transcriptId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { status, text, error } = await getTranscript(transcriptId);
    if (status === 'completed') {
      if (typeof text === 'string' && text.trim().length > 0) return text.trim();
      const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
      err.statusCode = 422;
      throw err;
    }
    if (status === 'error') {
      const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
      err.statusCode = 422;
      throw err;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  const err = new Error('Transcript timed out. Please try again or paste recipe text manually.');
  err.statusCode = 408;
  throw err;
}

/**
 * Fetch transcript for a YouTube URL via TranscriptAPI.com.
 * Returns plain text or throws with statusCode 422 and TRANSCRIPT_UNAVAILABLE_MSG.
 */
async function fetchYouTubeTranscript(videoUrl) {
  const apiKey = getTranscriptAPIKey();
  if (!apiKey) {
    const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
    err.statusCode = 422;
    throw err;
  }
  const params = new URLSearchParams({
    video_url: videoUrl,
    format: 'json',
    include_timestamp: 'false',
  });
  const apiUrl = `${TRANSCRIPTAPI_BASE}/youtube/transcript?${params}`;
  const res = await fetch(apiUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
    err.statusCode = 422;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  const segments = data.transcript;
  if (!Array.isArray(segments) || segments.length === 0) {
    const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
    err.statusCode = 422;
    throw err;
  }
  const text = segments.map((s) => (s && s.text) || '').filter(Boolean).join(' ').trim();
  if (!text) {
    const err = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
    err.statusCode = 422;
    throw err;
  }
  return text;
}

async function parseVideoToRecipe(url) {
  validateUrl(url);

  if (isYouTubeUrl(url)) {
    console.log('Fetching YouTube transcript via TranscriptAPI:', url.replace(/[#?].*/, ''));
    try {
      const transcriptText = await fetchYouTubeTranscript(url);
      console.log('YouTube transcript received, parsing recipe with AI...');
      const recipe = await parseTranscriptToRecipe(transcriptText);
      return { recipe, source: 'transcriptapi' };
    } catch (err) {
      if (err.statusCode === 422) throw err;
      const fallback = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
      fallback.statusCode = 422;
      throw fallback;
    }
  }

  console.log('Submitting URL to AssemblyAI for transcription:', url.replace(/[#?].*/, ''));

  let transcriptId;
  try {
    transcriptId = await submitTranscript(url);
  } catch (err) {
    if (err.statusCode === 422) throw err;
    const fallback = new Error(TRANSCRIPT_UNAVAILABLE_MSG);
    fallback.statusCode = 422;
    throw fallback;
  }

  const transcriptText = await waitForTranscript(transcriptId);
  console.log('Transcription completed, parsing recipe with AI...');
  const recipe = await parseTranscriptToRecipe(transcriptText);
  return { recipe, source: 'assemblyai' };
}

module.exports = { parseVideoToRecipe };
