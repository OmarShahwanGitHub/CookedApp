# Video parsing backend: AssemblyAI transcription only (no ffmpeg/yt-dlp)
FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["node", "index.js"]
