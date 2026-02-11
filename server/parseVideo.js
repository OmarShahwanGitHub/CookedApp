const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { transcribeAudio } = require('./transcribe');
const { parseTranscriptToRecipe } = require('./recipeParse');
const { fetchYouTubeCaptions } = require('./youtubeCaption');

function isYouTubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function getVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^\[::1\]$/,
    /^\[fd/,
    /^\[fe80/,
    /^metadata\.google/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      const err = new Error('URLs pointing to internal or private addresses are not allowed.');
      err.statusCode = 400;
      throw err;
    }
  }
}

async function parseVideoToRecipe(url) {
  validateUrl(url);

  if (isYouTubeUrl(url)) {
    return handleYouTube(url);
  }
  return handleGenericVideo(url);
}

async function handleYouTube(url) {
  const videoId = getVideoId(url);
  if (!videoId) {
    const err = new Error('Could not extract YouTube video ID from the URL.');
    err.statusCode = 400;
    throw err;
  }

  console.log(`Processing YouTube video: ${videoId}`);

  try {
    const captionText = await fetchYouTubeCaptions(videoId);
    if (captionText && captionText.trim().length > 50) {
      console.log(`Found captions (${captionText.length} chars), parsing recipe...`);
      const recipe = await parseTranscriptToRecipe(captionText);
      return { recipe, source: 'youtube_captions' };
    }
  } catch (err) {
    console.log('Caption fetch failed, falling back to audio transcription:', err.message);
  }

  console.log('No captions found, extracting audio...');
  const audioPath = await extractYouTubeAudio(url);
  try {
    const transcript = await transcribeAudio(audioPath);
    const recipe = await parseTranscriptToRecipe(transcript);
    return { recipe, source: 'youtube_audio_transcription' };
  } finally {
    cleanupFile(audioPath);
  }
}

async function handleGenericVideo(url) {
  console.log(`Processing generic video URL: ${url}`);
  const audioPath = await extractGenericAudio(url);
  try {
    const transcript = await transcribeAudio(audioPath);
    const recipe = await parseTranscriptToRecipe(transcript);
    return { recipe, source: 'video_audio_transcription' };
  } finally {
    cleanupFile(audioPath);
  }
}

function extractYouTubeAudio(url) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `yt-audio-${Date.now()}.mp3`);

    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'lowestaudio',
    });

    stream.on('error', (err) => {
      cleanupFile(tmpFile);
      if (err.message.includes('private') || err.message.includes('unavailable')) {
        const e = new Error('This video is private or unavailable.');
        e.statusCode = 403;
        reject(e);
      } else {
        reject(new Error(`Failed to download YouTube audio: ${err.message}`));
      }
    });

    const ffmpegProcess = ffmpeg(stream)
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioChannels(1)
      .audioFrequency(16000)
      .duration(600)
      .format('mp3')
      .on('end', () => resolve(tmpFile))
      .on('error', (err) => {
        cleanupFile(tmpFile);
        reject(new Error(`Audio conversion failed: ${err.message}`));
      })
      .save(tmpFile);
  });
}

function extractGenericAudio(url) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `vid-audio-${Date.now()}.mp3`);

    ffmpeg(url)
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioChannels(1)
      .audioFrequency(16000)
      .duration(600)
      .noVideo()
      .format('mp3')
      .on('end', () => resolve(tmpFile))
      .on('error', (err) => {
        cleanupFile(tmpFile);
        if (err.message.includes('403') || err.message.includes('401')) {
          const e = new Error('This video is private or requires authentication.');
          e.statusCode = 403;
          reject(e);
        } else {
          reject(new Error(`Failed to extract audio from video: ${err.message}`));
        }
      })
      .save(tmpFile);
  });
}

function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up temp file: ${filePath}`);
    }
  } catch (e) {
    console.warn(`Failed to clean up ${filePath}:`, e.message);
  }
}

module.exports = { parseVideoToRecipe };
