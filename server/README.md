# Video parsing backend

Runs separately from the Expo app. The app calls this backend over HTTP when the user adds a recipe from a video URL.

## Run locally

```bash
cd server
npm install
npm start
```

Runs on port 3001 by default. Set `VIDEO_BACKEND_PORT` to change it.

## Deploy for TestFlight / production

1. Deploy this server to a host that supports Node and has **ffmpeg** and **yt-dlp** installed (e.g. Railway, Render, Fly.io, or a VPS).
2. Set these env vars on the server: `OPENAI_API_KEY` (or `EXPO_PUBLIC_OPENAI_API_KEY`) for Whisper transcription; optionally the same LLM keys as the app for recipe parsing.
3. In your **Expo app** (and in EAS env vars for production), set:
   - **EXPO_PUBLIC_VIDEO_BACKEND_URL** = the public URL of this backend (e.g. `https://your-video-backend.railway.app` or `https://api.yourapp.com`).

No trailing slash. The app will call `POST {EXPO_PUBLIC_VIDEO_BACKEND_URL}/parse-video` with `{ "url": "..." }`.

## Privacy & support pages

The same deployment serves static pages from `public/`:

- **Privacy policy:** `https://your-backend-url/` (index.html)
- **Support:** `https://your-backend-url/support.html`

Use these URLs in App Store Connect for Privacy Policy URL and Support URL.
