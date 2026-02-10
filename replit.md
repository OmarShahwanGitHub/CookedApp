# Cooked Recipe App

## Overview
A recipe management app built with Expo (React Native for Web) and expo-router. Users can browse, add, and manage recipes across Home, Grocery, and Library tabs.

## Recent Changes
- 2026-02-10: Initial import and Replit environment setup. Configured Expo web to run on port 5000.

## Project Architecture
- **Framework**: Expo SDK 54 with React Native Web
- **Routing**: expo-router (file-based routing)
- **State Management**: Zustand + React Query (@tanstack/react-query)
- **Storage**: AsyncStorage (@react-native-async-storage/async-storage)
- **UI**: Lucide React Native icons, Expo Image, Expo Linear Gradient
- **Build Tool**: Metro bundler with @rork-ai/toolkit-sdk metro plugin

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
constants/            # Colors, categories
context/              # React context (RecipeContext)
types/                # TypeScript type definitions
utils/                # Utility functions (parseRecipe)
assets/               # Images and icons
```

## Development
- **Start**: `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 npx expo start --web --port 5000 --host lan`
- **Export**: `npx expo export --platform web`
- **Port**: 5000 (web)
- **Package Manager**: npm (with --legacy-peer-deps for install)

## Deployment
- Static export via `npx expo export --platform web`
- Output directory: `dist/`
