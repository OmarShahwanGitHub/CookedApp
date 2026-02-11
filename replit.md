# Cooked Recipe App

## Overview
A recipe management app built with Expo (React Native for Web/iOS) and expo-router. Users can browse, add, and manage recipes across Home, Grocery, and Library tabs. Supports recipe input via pasted text, URLs, images (AI vision), and video (YouTube captions + audio transcription via backend). Includes RevenueCat paywall integration (10 free recipes, subscription unlocks unlimited).

## Recent Changes
- 2026-02-11: Added Node.js backend (Express) for video-to-recipe parsing with YouTube caption extraction, audio transcription (OpenAI Whisper), and multi-provider recipe parsing fallback. Frontend video input now calls the backend directly.
- 2026-02-11: "Cook Again" button moved to top of recipe detail, added reminder toggle (defaults off) in Cook Again modal.
- 2026-02-11: Fixed timezone bug causing dates to display one day behind across all date displays.
- 2026-02-10: Major refactor — removed @rork-ai/toolkit-sdk, cleaned up dependencies, implemented unified recipe parsing pipeline, added RevenueCat subscription service, local notifications, paywall screen, and video input mode.
- 2026-02-10: Initial import and Replit environment setup.

## User Preferences
- Prefers stability and simplicity over cleverness
- iOS-focused (Expo Go / TestFlight-ready)
- No web-only or Node-only APIs
- No social features, public feeds, or ebook uploads
- No Replit-managed AI services — all AI providers handled manually via environment variables
- AI provider fallback hierarchy: Anthropic → OpenAI → Gemini

## Project Architecture
- **Framework**: Expo SDK 54 with React Native Web
- **Routing**: expo-router (file-based routing)
- **State Management**: React Context + React Query (@tanstack/react-query)
- **Storage**: AsyncStorage (@react-native-async-storage/async-storage)
- **UI**: Lucide React Native icons, Expo Image, Expo Linear Gradient
- **Build Tool**: Metro bundler (standard Expo config)
- **Subscriptions**: RevenueCat (react-native-purchases)
- **Notifications**: expo-notifications (local only)
- **Video Processing**: Metro custom middleware + @distube/ytdl-core, fluent-ffmpeg, ffmpeg (system)
- **Transcription**: OpenAI Whisper API (requires OPENAI_API_KEY)
- **Backend**: Video parsing runs as Metro middleware (dev) or standalone Express server (production)

## Project Structure
```
app/                  # File-based routes (expo-router)
  (tabs)/             # Tab navigation
    (home)/           # Home tab
    grocery/          # Grocery tab
    library/          # Library tab
  recipe/[id].tsx     # Dynamic recipe detail page
  add-recipe.tsx      # Add recipe modal
  _layout.tsx         # Root layout
components/           # Reusable UI components
  RecipeCard.tsx
  EmptyState.tsx
  PaywallScreen.tsx   # RevenueCat paywall UI
constants/            # Colors, categories
context/              # React context (RecipeContext)
services/             # Service layer
  inputNormalizer.ts  # Unified input → text conversion
  recipeParser.ts     # LLM-based recipe parsing (with fallback)
  notificationService.ts  # Local notification scheduling
  subscriptionService.ts  # RevenueCat integration
server/               # Backend server (Express)
  index.js            # Express app entry point (port 3001)
  parseVideo.js       # Video URL → recipe orchestrator
  youtubeCaption.js   # YouTube caption/transcript fetcher
  transcribe.js       # OpenAI Whisper audio transcription
  recipeParse.js      # Server-side recipe parsing (Anthropic → OpenAI → Gemini)
types/                # TypeScript type definitions
utils/                # Utility functions
assets/               # Images and icons
```

## Development
- **Start (web)**: `npx expo start --web --port 5000`
- **Start (iOS)**: `npx expo start --ios`
- **Export**: `npx expo export --platform web`
- **Port**: 5000 (Expo web dev server, also serves /parse-video API via Metro middleware)
- **Production backend**: `node server/index.js` (standalone Express, set EXPO_PUBLIC_VIDEO_BACKEND_URL)
- **Package Manager**: npm (with --legacy-peer-deps for install)

## Where to Add API Keys
All keys should be set as environment variables — never hardcoded in code:
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY` — for LLM-based recipe parsing (tried first)
- `EXPO_PUBLIC_OPENAI_API_KEY` or `OPENAI_API_KEY` — for LLM-based recipe parsing (tried second) AND Whisper audio transcription (required for video)
- `EXPO_PUBLIC_GEMINI_API_KEY` or `GEMINI_API_KEY` — for LLM-based recipe parsing (tried third)
- `REVENUECAT_API_KEY` or `EXPO_PUBLIC_REVENUECAT_API_KEY` — for subscription management
- `EXPO_PUBLIC_VIDEO_BACKEND_URL` — URL of the video parser backend (defaults to http://localhost:3001)

## How Video Parsing Works
1. Frontend sends video URL to POST /parse-video on the backend
2. Backend detects platform (YouTube vs other)
3. For YouTube: tries to fetch existing captions first, falls back to audio extraction
4. For non-YouTube: extracts audio directly via ffmpeg
5. Audio is transcribed using OpenAI Whisper API
6. Transcript is parsed into structured recipe JSON using AI provider fallback (Anthropic → OpenAI → Gemini)
7. Temp audio files are cleaned up immediately after processing

## How Monetization Works
- Free tier: 10 saved recipes max
- Paywall screen shown when limit is reached
- RevenueCat manages subscription state (anonymous users supported)
- Subscription unlocks unlimited recipes
- Users can restore purchases from the paywall screen

## Deployment
- Static export via `npx expo export --platform web`
- Output directory: `dist/`
- Backend must be deployed separately or combined with a reverse proxy for production
