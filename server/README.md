# Video parsing backend

Runs separately from the Expo app. The app sends a video URL to this backend:

- **YouTube** – transcript via [TranscriptAPI.com](https://transcriptapi.com).
- **Facebook, Instagram, Pinterest, TikTok, X/Twitter, Dailymotion, Vimeo, Loom** – transcript via [Apify Video Transcriber](https://apify.com/invideoiq/video-transcriber) (speech-to-text).
- **Other URLs** (direct media links) – transcript via **AssemblyAI**.

Recipe parsing uses your existing AI (Anthropic → OpenAI → Gemini). No scraping, no cookies, no ffmpeg.

## Run locally

```bash
cd server
npm install
npm start
```

Runs on port 3001 by default. Set `VIDEO_BACKEND_PORT` to change it.

## Environment variables

- **TRANSCRIPTAPI_API_KEY** – For YouTube. Get a key at [transcriptapi.com](https://transcriptapi.com).
- **APIFY_API_TOKEN** – For Facebook, Instagram, Pinterest, TikTok, X, etc. Get a token at [apify.com](https://apify.com) (Actor: [Video Transcriber](https://apify.com/invideoiq/video-transcriber); paid per result).
- **ASSEMBLYAI_API_KEY** – For direct media URLs (e.g. `https://example.com/audio.mp3`). Get a key at [assemblyai.com](https://www.assemblyai.com).
- **ANTHROPIC_API_KEY** / **OPENAI_API_KEY** / **GEMINI_API_KEY** (or `EXPO_PUBLIC_*` variants) – At least one required for recipe parsing (Anthropic → OpenAI → Gemini fallback).

## Deploy for TestFlight / production

1. Deploy this server to a Node host (e.g. Render, Railway, Fly.io). No ffmpeg or yt-dlp needed.
2. Set **TRANSCRIPTAPI_API_KEY** (YouTube), **APIFY_API_TOKEN** (Facebook/Instagram/Pinterest/TikTok/etc.), **ASSEMBLYAI_API_KEY** (direct media URLs), and at least one LLM key (see above) on the server.
3. In your **Expo app** (and EAS env for production), set:
   - **EXPO_PUBLIC_VIDEO_BACKEND_URL** = your backend URL (e.g. `https://cookedapp.onrender.com`). No trailing slash.

The app calls `POST {EXPO_PUBLIC_VIDEO_BACKEND_URL}/parse-video` with `{ "url": "<video URL>" }`.

If transcription fails (e.g. unsupported URL or AssemblyAI error), the API returns 422 with:
`{ "error": "Transcript unavailable. Please paste recipe text manually." }`

## Privacy & support pages

The same deployment serves static pages from `public/`:

- **Privacy policy:** `https://your-backend-url/` (index.html)
- **Support:** `https://your-backend-url/support.html`

Use these URLs in App Store Connect for Privacy Policy URL and Support URL.
