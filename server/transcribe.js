const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const https = require('https');

function getApiKey() {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  return key || null;
}

async function transcribeAudio(audioFilePath) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      'OpenAI API key is required for audio transcription. ' +
      'Set OPENAI_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY in your environment variables.'
    );
    err.statusCode = 400;
    throw err;
  }

  const stat = fs.statSync(audioFilePath);
  console.log(`Transcribing audio file: ${path.basename(audioFilePath)} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);

  if (stat.size > 25 * 1024 * 1024) {
    throw new Error('Audio file exceeds 25MB limit for Whisper API.');
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(audioFilePath), {
    filename: path.basename(audioFilePath),
    contentType: 'audio/mpeg',
  });
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  form.append('response_format', 'text');

  const transcript = await new Promise((resolve, reject) => {
    const request = https.request(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders(),
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            let errorMsg = `Whisper API error (${res.statusCode})`;
            try {
              const errBody = JSON.parse(data);
              errorMsg += `: ${errBody.error?.message || data}`;
            } catch {
              errorMsg += `: ${data}`;
            }
            reject(new Error(errorMsg));
          } else {
            resolve(data);
          }
        });
        res.on('error', reject);
      }
    );

    request.on('error', reject);
    form.pipe(request);
  });

  if (!transcript || transcript.trim().length < 10) {
    throw new Error('Transcription returned very little text. The video may not contain speech about a recipe.');
  }

  console.log(`Transcription complete: ${transcript.length} chars`);
  return transcript.trim();
}

module.exports = { transcribeAudio };
