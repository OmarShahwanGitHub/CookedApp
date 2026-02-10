# Cooked Recipe App

## Overview
A recipe management app built with Expo (React Native for Web/iOS) and expo-router. Users can browse, add, and manage recipes across Home, Grocery, and Library tabs. Supports recipe input via pasted text, URLs, images (OCR stub), and video (transcription stub). Includes RevenueCat paywall integration (10 free recipes, subscription unlocks unlimited).

## Recent Changes
- 2026-02-10: Major refactor — removed @rork-ai/toolkit-sdk, cleaned up dependencies, implemented unified recipe parsing pipeline, added RevenueCat subscription service, local notifications, paywall screen, and video input mode.
- 2026-02-10: Initial import and Replit environment setup.

## User Preferences
- Prefers stability and simplicity over cleverness
- iOS-focused (Expo Go / TestFlight-ready)
- No web-only or Node-only APIs
- No social features, public feeds, or ebook uploads

## Project Architecture
- **Framework**: Expo SDK 54 with React Native Web
- **Routing**: expo-router (file-based routing)
- **State Management**: React Context + React Query (@tanstack/react-query)
- **Storage**: AsyncStorage (@react-native-async-storage/async-storage)
- **UI**: Lucide React Native icons, Expo Image, Expo Linear Gradient
- **Build Tool**: Metro bundler (standard Expo config)
- **Subscriptions**: RevenueCat (react-native-purchases)
- **Notifications**: expo-notifications (local only)

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
types/                # TypeScript type definitions
utils/                # Utility functions
assets/               # Images and icons
```

## Development
- **Start (web)**: `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 npx expo start --web --port 5000 --host lan`
- **Start (iOS)**: `npx expo start --ios`
- **Export**: `npx expo export --platform web`
- **Port**: 5000 (web)
- **Package Manager**: npm (with --legacy-peer-deps for install)

## Where to Add API Keys
All keys should be set as environment variables — never hardcoded in code:
- `ANTHROPIC_API_KEY` — for LLM-based recipe parsing (tried first)
- `OPENAI_API_KEY` — for LLM-based recipe parsing (tried second)
- `GEMINI_API_KEY` — for LLM-based recipe parsing (tried third)
- `REVENUECAT_API_KEY` or `EXPO_PUBLIC_REVENUECAT_API_KEY` — for subscription management
- `OCR_API_KEY` — for image-to-text extraction (stub, not yet implemented)
- `TRANSCRIPTION_API_KEY` — for video-to-text transcription (stub, not yet implemented)

## How Monetization Works
- Free tier: 10 saved recipes max
- Paywall screen shown when limit is reached
- RevenueCat manages subscription state (anonymous users supported)
- Subscription unlocks unlimited recipes
- Users can restore purchases from the paywall screen

## Deployment
- Static export via `npx expo export --platform web`
- Output directory: `dist/`
