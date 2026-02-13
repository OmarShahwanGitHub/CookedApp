# Cooked App — Tech Stack, Architecture & RevenueCat

This document describes the technology stack, application architecture, and RevenueCat subscription implementation for the Cooked recipe management app.

---

## Tech Stack

### Client (Mobile & Web)

| Layer | Technology |
|-------|------------|
| **Framework** | [Expo](https://expo.dev) ~54 (React Native) |
| **Routing** | [expo-router](https://docs.expo.dev/router/introduction/) ~6 (file-based, typed routes) |
| **UI** | React 19, React Native 0.81, [lucide-react-native](https://lucide.dev) icons |
| **State** | [Zustand](https://github.com/pmndrs/zustand) ^5, [@tanstack/react-query](https://tanstack.com/query/latest) ^5 |
| **Persistence** | [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) |
| **Subscriptions** | [react-native-purchases](https://github.com/RevenueCat/react-native-purchases) (RevenueCat SDK) ^8.2 |
| **AI / Parsing** | [OpenAI](https://www.npmjs.com/package/openai) ^6 — configurable with Anthropic/Gemini via env (see `services/recipeParser.ts`) |
| **Media** | expo-image-picker, expo-image-manipulator, expo-image |
| **Other** | expo-notifications, expo-haptics, expo-blur, expo-linear-gradient, expo-web-browser, expo-dev-client |

- **Platforms:** iOS, Android, Web (RevenueCat and some native features are iOS/Android only; web runs with graceful fallbacks).
- **Build:** [EAS Build](https://docs.expo.dev/build/introduction/) (see `eas.json`). RevenueCat requires a **custom development build** (not Expo Go) for real purchase behavior.

### Backend (Video Parsing)

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Server** | [Express](https://expressjs.com) ^5 |
| **Video** | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) (audio extraction) |
| **Transcription** | Backend uses its own transcription/recipe parsing (see `server/transcribe.js`, `server/recipeParse.js`) |
| **YouTube** | Custom caption fetch + optional audio transcription |

- **Deployment:** Standalone service; configurable via `EXPO_PUBLIC_VIDEO_BACKEND_URL` (or Metro/debugger host in dev). Not part of the Expo app bundle.

### Development & Tooling

- **Language:** TypeScript (client), JavaScript (server)
- **Linting:** ESLint with eslint-config-expo
- **Env:** `.env` / `.env.example`; Expo inlines `EXPO_PUBLIC_*` at build time. EAS env vars for production.

---

## Architecture

### High-Level Structure

```
CookedApp/
├── app/                    # expo-router screens
│   ├── _layout.tsx         # Root: QueryClient, GestureHandler, RecipeProvider, subscription init
│   ├── (tabs)/             # Tab navigator: Home, Grocery, Library
│   ├── add-recipe.tsx      # Modal: add recipe flow, paywall gate
│   └── recipe/[id].tsx     # Recipe detail
├── components/             # Reusable UI (e.g. PaywallScreen, RecipeCard, EmptyState)
├── context/                # RecipeContext (recipes CRUD + persistence)
├── services/               # subscriptionService, recipeParser, inputNormalizer
├── utils/                  # parseRecipe (orchestrates text/image/video parsing)
├── constants/              # colors, categories
├── types/                  # Recipe and related types
└── server/                 # Standalone video parsing backend (Express)
```

### Data & State

- **Recipes:** Stored in AsyncStorage under a single key; loaded/saved via React Query (`queryKey: ['recipes']`) and synced in `RecipeContext` with `syncRecipes` mutation. No backend database; all recipe state is local.
- **Subscription state:** Not stored in AsyncStorage. Determined on demand via RevenueCat SDK (`getCustomerInfo()`, entitlements). Cached in memory by the SDK.

### Recipe Parsing Pipeline

1. **Text / URL (article):**  
   `parseRecipe` → `normalizeInputToText` (fetch URL if needed) → `parseRecipeFromText` in `recipeParser.ts` (AI: OpenAI/Anthropic/Gemini via env keys).

2. **Image:**  
   `parseRecipe` → `parseRecipeFromImages` (vision API) in `recipeParser.ts`.

3. **Video:**  
   `parseRecipe` → `parseVideoViaBackend` in `utils/parseRecipe.ts` → HTTP `POST /parse-video` to the Node server → server uses YouTube captions and/or audio transcription + recipe parsing (see `server/parseVideo.js`, `server/recipeParse.js`).

### Paywall Gate (Add Recipe)

- When the user tries to **save** a new recipe in `add-recipe.tsx`, the app calls `canAddRecipe(recipes.length)` from `subscriptionService`.
- **Free limit:** 10 recipes (constant `FREE_RECIPE_LIMIT` in `subscriptionService.ts`).
- If the user is at or over the limit and not entitled, `canAddRecipe` returns `false` and the add-recipe screen shows `PaywallScreen` instead of saving.
- After a successful purchase or restore, the UI calls `onSubscribed()` and the user can save the recipe.

### Navigation

- **Root:** Stack (expo-router) with tabs, add-recipe (modal), and recipe detail.
- **Tabs:** Home, Grocery, Library (each with its own layout/screen under `app/(tabs)/`).

---

## RevenueCat Implementation

### Overview

- **Role:** Cross-platform in-app purchases and subscription state (e.g. “premium” entitlement).
- **SDK:** `react-native-purchases` (RevenueCat). Configured once at app startup; used for offerings, purchase, restore, and entitlement checks.
- **Platform support:** RevenueCat is **not** available on web (no native StoreKit/Play Billing). On web, `getPurchases()` returns `null` and the app skips configure/purchase/restore and shows a message to configure the API key.

### Configuration

- **API key:**  
  - Read from `process.env.EXPO_PUBLIC_REVENUECAT_API_KEY` or `process.env.REVENUECAT_API_KEY` (see `getRevenueCatApiKey()` in `services/subscriptionService.ts`).  
  - Set in `.env` for local/dev and in EAS environment variables for production.  
  - Use the **iOS public API key** (e.g. `appl_...`) for iOS builds.
- **Initialization:**  
  `initializeSubscriptions()` is called from `app/_layout.tsx` on app load. It configures the RevenueCat SDK with the API key; if the key is missing or configure fails, the rest of the app still runs (no purchases).

### Entitlements & Limits

- **Entitlement identifier:** `premium`.  
  - Subscribed if `customerInfo.entitlements.active['premium']` is defined (see `checkSubscriptionStatus()`, `purchasePackage()`, `restorePurchases()`).
- **Free tier:** 10 recipes. Subscribers get unlimited (logic in `checkSubscriptionStatus()` and `canAddRecipe()`).

### Main APIs Used

| Purpose | Service function | RevenueCat usage |
|--------|------------------|-------------------|
| App startup | `initializeSubscriptions()` | `purchases.configure({ apiKey })` |
| Can user add recipe? | `canAddRecipe(currentRecipeCount)` | Uses `checkSubscriptionStatus()` → `getCustomerInfo()`, then compares count to limit |
| Subscription status | `checkSubscriptionStatus()` | `getCustomerInfo()`, check `entitlements.active['premium']` |
| Paywall offerings | `getOfferings()` | `getOfferings()` → `offerings.current.availablePackages` |
| Purchase | `purchasePackage(pkg)` | `purchasePackage(pkg)` → check `customerInfo.entitlements.active['premium']` |
| Restore | `restorePurchases()` | `restorePurchases()` → same entitlement check |

### Paywall UI

- **Component:** `components/PaywallScreen.tsx`.
- **Props:** `onDismiss`, `onSubscribed`. Used inside the add-recipe modal when the user is over the free limit.
- **Behavior:**  
  - Loads packages via `getOfferings()` and shows them as buttons (title + price).  
  - “Restore Purchases” calls `restorePurchases()` and then `onSubscribed()` if an active subscription is found.  
  - If no packages are available, shows a message that depends on `isRevenueCatConfigured()` (e.g. “create products in App Store Connect and add them to an offering in the RevenueCat dashboard” vs “add EXPO_PUBLIC_REVENUECAT_API_KEY”).  
  - Debug text from `getLastOfferingsDebug()` can be shown to help with missing offerings (e.g. no current offering, no packages, or RevenueCat errors).

### Setup Checklist (RevenueCat + App Store)

1. **RevenueCat project:** Create project, add iOS app, link App Store Connect (e.g. API key / in-app purchases).
2. **App Store Connect:** Create subscription product(s) (e.g. `com.cooked.recipe.pro_monthly`), attach to app.
3. **RevenueCat dashboard:** Create an offering (e.g. “default”), add package(s) that reference the App Store product(s), set “default” as **Current** offering.
4. **App:** Set `EXPO_PUBLIC_REVENUECAT_API_KEY` (iOS public key) in `.env` or EAS env.
5. **Build:** Use a **development build** (EAS or local) so the native RevenueCat/StoreKit code runs; Expo Go only runs RevenueCat in “Preview” mode (no real purchases).

### Privacy & Third-Party

- Payment and subscription state are handled by Apple (and RevenueCat). The app does not store payment details.  
- Privacy site and support pages reference RevenueCat for subscription management and link to [RevenueCat’s privacy policy](https://www.revenuecat.com/privacy).

---

## Environment Variables (Summary)

| Variable | Where | Purpose |
|----------|--------|---------|
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | Client | RevenueCat SDK (iOS public key for production). |
| `EXPO_PUBLIC_OPENAI_API_KEY` / `EXPO_PUBLIC_ANTHROPIC_API_KEY` / `EXPO_PUBLIC_GEMINI_API_KEY` | Client | AI recipe parsing (see recipeParser). |
| `EXPO_PUBLIC_VIDEO_BACKEND_URL` | Client | Base URL of the video parsing server (optional; falls back to Metro/debugger host or localhost). |
| Server env (e.g. `PORT`, transcription keys) | Server | Used by the Node video backend only. |

See `.env.example` for a template.

---

*Last updated to reflect the codebase as of the creation of this document.*
