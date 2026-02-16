# Video parsing backend

Runs separately from the Expo app. The app sends a video URL to this backend; the backend uses **AssemblyAI** for transcription and existing AI (Anthropic / OpenAI / Gemini) for recipe parsing. No YouTube scraping, no cookies, no ffmpeg/yt-dlp.

## Run locally

```bash
cd server
npm install
npm start
```

Runs on port 3001 by default. Set `VIDEO_BACKEND_PORT` to change it.

## Environment variables

- **ASSEMBLYAI_API_KEY** (required) – Your AssemblyAI API key for URL-based transcription.
- **OPENAI_API_KEY** or **EXPO_PUBLIC_OPENAI_API_KEY** – Used by recipe parsing (Whisper not used for video flow).
- **ANTHROPIC_API_KEY** / **OPENAI_API_KEY** / **GEMINI_API_KEY** (or `EXPO_PUBLIC_*` variants) – At least one required for recipe parsing (Anthropic → OpenAI → Gemini fallback).

## Deploy for TestFlight / production

1. Deploy this server to a Node host (e.g. Render, Railway, Fly.io). No ffmpeg or yt-dlp needed.
2. Set **ASSEMBLYAI_API_KEY** and at least one LLM key (see above) on the server.
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
