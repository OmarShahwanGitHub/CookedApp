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

### YouTube "Sign in to confirm you're not a bot" (production only)

On cloud hosts (Render, etc.) YouTube often blocks requests from datacenter IPs. It works locally because your home/office IP is not flagged. To fix production:

1. **Export YouTube cookies** (Netscape format) while logged into YouTube in your browser:
   - Use an extension like "Get cookies.txt" (Chrome) or "cookies.txt" (Firefox), or see [yt-dlp: Exporting YouTube cookies](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies).
   - Save as a `.txt` file (e.g. `youtube_cookies.txt`).

2. **On Render:** Environment → **Secret Files**. Add a new secret file:
   - **Filename:** `youtube_cookies.txt` (or any name).
   - **Contents:** paste the full contents of your exported cookie file.
   - Render mounts it at `/etc/secrets/youtube_cookies.txt` (path = `/etc/secrets/` + filename).

3. **Set env var** on the same Render service:
   - **YTDLP_COOKIES_PATH** = `/etc/secrets/youtube_cookies.txt` (use the path Render shows for your secret file).

4. Redeploy. Cookies expire; re-export and update the secret file every few weeks if downloads start failing again.

## Privacy & support pages

The same deployment serves static pages from `public/`:

- **Privacy policy:** `https://your-backend-url/` (index.html)
- **Support:** `https://your-backend-url/support.html`

Use these URLs in App Store Connect for Privacy Policy URL and Support URL.
