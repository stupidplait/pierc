# 19 — React Native Mobile App

> Phase 2 work stream 5. The "React Native mobile app" item from
> [`13-phase-2.md`](./13-phase-2.md), trimmed to a WebView-shell
> architecture (the spec's recommended path).
>
> **Status legend:** ✅ done · 🟡 partial · ⏸ paused · ⬜ not started.

A native iOS + Android app — built with [Expo](https://expo.dev/) +
[expo-router](https://docs.expo.dev/router/introduction/) — that
wraps the existing live web app in a `WebView`. The native shell
provides only the things a WebView genuinely can't (bottom tab nav,
deep linking, push notifications, hardware-back-button handling,
external-link interception, native share); everything else — the
3D try-on, lite mode, booking flow, account, content pages — is the
production web app rendered in a `WKWebView` (iOS) /
`System WebView` (Android).

## Problem statement

Customers asking for "your app on the App Store" expect a tappable
icon they can install, push notifications for booking confirmations,
and discoverability through Apple/Google search. None of that is a
PWA can offer cleanly enough on iOS today (PWAs on iOS are still
second-class — limited push support, no App Store presence, "Add to
Home Screen" is buried in the share sheet).

We don't, however, want to maintain two 3D codebases (web and
react-three-fiber/native), two MediaPipe integrations (WASM and
Apple Vision / Google ML Kit), or two implementations of every
booking-flow form. The WebView-shell pattern keeps the entire web
codebase as the single source of truth; the native app is a thin
container that gives us the App Store presence + native chrome.

## Architecture

```mermaid
flowchart TB
  subgraph "Native shell (Expo)"
    Splash[Splash screen]
    Tabs[Bottom tab nav<br/>Главная · Каталог · Запись · Профиль]
    DeepLink[expo-linking<br/>pierc://catalog/&lt;id&gt;]
    BackBtn[Hardware back button]
    Share[Native share sheet]
    Notif[Expo Notifications<br/>(scaffolding only)]
  end

  subgraph WebView
    Site[Live web app at APP_URL]
  end

  subgraph "External (system browser)"
    Telegram[t.me / wa.me / instagram.com]
  end

  Splash --> Tabs
  Tabs --> Site
  DeepLink --> Site
  BackBtn -- WebView history --> Site
  Site -. user taps Telegram link .-> Telegram
  Site -. user taps Share .-> Share
```

The four tabs each load a different URL inside the same WebView:

| Tab | RU label | Loads |
|---|---|---|
| Home | Главная | `${APP_URL}/` |
| Catalog | Каталог | `${APP_URL}/catalog` |
| Book | Запись | `${APP_URL}/book` |
| Account | Профиль | `${APP_URL}/account` |

Tapping a tab navigates the WebView to the corresponding URL.
Within a tab, normal in-WebView navigation works (e.g., tapping a
jewelry card on `/catalog` goes to `/catalog/<id>` inside the
WebView; the bottom tab still says "Каталог"). The hardware back
button (Android) and edge-swipe (iOS) traverse the WebView's history
until reaching the tab's entry URL, then exit / change tabs.

## Repo structure

```
pierc/                  ← repo root (this Next.js project, unchanged)
├── app/
├── lib/
├── prisma/
├── docs/
│   └── 19-mobile-app.md ← this file
├── mobile/             ← NEW — Expo app
│   ├── app/            ← expo-router routes
│   │   ├── _layout.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── catalog.tsx
│   │   │   ├── book.tsx
│   │   │   └── account.tsx
│   │   └── +not-found.tsx
│   ├── components/
│   │   └── PiercWebView.tsx
│   ├── constants/
│   │   └── config.ts
│   ├── app.json        ← Expo config (icon, splash, plist, deep-linking)
│   ├── eas.json        ← EAS Build config (placeholder)
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   └── README.md       ← mobile-specific dev workflow
└── ...
```

The web Next.js project is **completely unchanged** — Vercel deploy
configuration, build scripts, root `package.json` all stay as-is.
The mobile app is a sibling that happens to live in the same git
repo.

`.gitignore` adds:
```
mobile/node_modules/
mobile/.expo/
mobile/dist/
mobile/ios/Pods/
mobile/android/build/
mobile/.expo-shared/
```

Migrating to a real Turborepo monorepo later (if a third app or
shared-package pain materializes) is a directory rename + adding
`pnpm-workspace.yaml` — no logical refactor.

## Scope

### In v1

- **Expo SDK 52+ project** scaffolded under `mobile/`, with
  TypeScript and `expo-router`.
- **Bottom tab navigation** (4 tabs) using `expo-router`'s
  file-based routing under `mobile/app/(tabs)/`.
- **`<PiercWebView>` wrapper** around `react-native-webview` with:
  - `cacheEnabled` + `domStorageEnabled` so cookies/auth persist
  - External-link interception via `onShouldStartLoadWithRequest` —
    `t.me/`, `wa.me/`, `instagram.com/`, etc. open in the system
    browser via `expo-web-browser`, not inside the WebView
  - Pull-to-refresh
  - Loading + error states
- **Hardware back button** (Android) calls `webViewRef.goBack()`
  while history exists; otherwise default behavior (exit / change
  tab).
- **Deep linking** via `expo-linking`. URL scheme `pierc://` (e.g.,
  `pierc://catalog/abc123` opens the catalog tab and navigates the
  WebView to `/catalog/abc123`). Universal Links / App Links are
  configured in `app.json` so `https://piercing.studio/catalog/...`
  links also open the app when installed.
- **Native share button** in the WebView header — taps invoke the
  iOS share sheet / Android Intent with the current page URL.
- **Splash screen + app icon** scaffolds (placeholders the studio
  swaps with branded assets later).
- **`Info.plist` permissions** for the lite-mode selfie upload:
  `NSPhotoLibraryUsageDescription` (RU copy), `NSCameraUsageDescription`
  (RU copy). Same on Android via `app.json` permissions.
- **Russian-only UI.** The few RU strings in the native shell
  (tab labels, error messages) are inlined; no i18n framework
  needed for ~10 strings.
- **Expo Go dev workflow** — `cd mobile && npx expo start`, scan
  QR code with the Expo Go app on your phone, see the app live
  with hot reload. No iOS/Android build tooling needed for dev.

### Deferred to a follow-up

- **Push notifications** — Expo Notifications integration, device
  token registration to a new `/api/mobile/push-tokens` endpoint,
  triggers from booking confirmation / status change emails. Needs
  schema work (`DeviceToken` model) and server-side dispatch logic.
  Tracked separately so this stream can ship working WebView-only.
- **Native catalog grid / jewelry detail / booking screens** — the
  spec sketched this but it's the worst of both worlds (porting
  cost + WebView still needed for the 3D try-on). Skip for v1; if
  some specific screen genuinely needs native UX (e.g., camera-
  based AR), peel that one screen off later.
- **Offline mode** — partial caching of catalog data via Service
  Worker on the web side could light this up later. Not in v1.
- **Biometric auth** (Face ID / Touch ID) for `/account` — defer
  until there's a user story that benefits.
- **In-app purchase** — N/A; this is a no-payment booking app.

### What's user-side (cannot be done in this scaffolding session)

- **Apple Developer Program** signup ($99/year). Required for
  TestFlight beta + App Store submission.
- **Google Play Console** signup ($25 one-time). Required for
  Internal Testing track + Play Store submission.
- **App Store Connect listing** — name, screenshots, description,
  age rating, privacy policy URL, demo account credentials,
  category, keywords. ~1-2 weeks first-review cycle.
- **Google Play Console listing** — same fields. ~24-48h review.
- **Code signing** — iOS provisioning profiles (managed by EAS or
  manual via Xcode), Android keystore generation + retention.
  Losing the Android keystore = updates die forever; back it up.
- **EAS Build subscription decision** — free tier exists for low
  build volume; paid tiers $19–99/mo for higher quotas.
- **Branded splash screen + app icon assets** — 1024×1024 icon,
  2778×1284 splash (iOS) + Android adaptive icon foreground/
  background. Studio commissions or makes these.

These are listed in `mobile/README.md` as a checklist.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Native runtime | Expo SDK 52+ | Manages iOS + Android native code via EAS Build |
| Routing | expo-router | File-based routing, RN equivalent of Next.js App Router |
| WebView | react-native-webview | Maintained, Expo-supported |
| Deep linking | expo-linking | Standard Expo deep-link helper |
| External links | expo-web-browser | Opens external URLs in the system browser, not the WebView |
| Status bar | expo-status-bar | Themed status bar |
| Splash | expo-splash-screen | Native splash before JS bundle loads |
| Tab icons | @expo/vector-icons (Ionicons) | Built-in, no extra deps |

No `@react-navigation/*` direct deps — `expo-router` brings them
transitively.

## Dev workflow

After Task 2 lands, the `mobile/README.md` walks through:

```bash
cd mobile
npm install               # one-time
npx expo start            # opens Metro + QR code
# scan QR with Expo Go app on iOS/Android
# tap any code change → app hot-reloads on device
```

For native test builds (closer to App Store reality):
```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform ios     # produces an .ipa
eas build --profile preview --platform android # produces an .apk
```

## Configuration

`mobile/constants/config.ts` exports:
```ts
export const APP_URL = "https://piercing.studio"; // production
// In dev, override via process.env.EXPO_PUBLIC_APP_URL
```

In dev, set `EXPO_PUBLIC_APP_URL` in `mobile/.env.local` to point
at a local `npm run dev` Next.js or a Vercel preview URL.

`app.json` carries the deep-link scheme + universal-link host
configuration. The studio's production domain (e.g.,
`piercing.studio`) becomes the `associatedDomains` entry once it's
live and serving an `apple-app-site-association` file.

## Task list

### Task 1: Documentation ✅

This file. Plus the back-reference in
[`13-phase-2.md`](./13-phase-2.md). No application code changes.

### Task 2: Scaffold mobile/ project files ✅

Create the `mobile/` directory with `package.json`, `tsconfig.json`,
`app.json`, `babel.config.js`, `eas.json` placeholder, and the
expo-router file structure (empty route files at first).
`.gitignore` updated.

**Demo:** `cd mobile && npm install && npx expo start` produces a
running QR code that loads a placeholder screen on Expo Go.

### Task 3: Native shell — tabs + WebView + back button + share ✅

Implement the four tab routes, `<PiercWebView>` wrapper, hardware
back-button handling, external-link interception, native share
button.

**Demo:** scan QR on Expo Go → bottom tabs work → tapping
"Каталог" opens the live web `/catalog` → navigation inside the
WebView works → Android back button traverses history → tapping a
Telegram link in the web `/about` opens the system browser, not
the WebView.

### Task 4: Deep linking + README + finalize ✅

`expo-linking` config in `app.json` + a top-level handler in
`app/_layout.tsx`. `mobile/README.md` covers dev workflow, EAS
Build for native test builds, and the "what you (the studio
owner) need to do" checklist for App Store / Play Store
submission.

**Demo:** sending `pierc://catalog/<id>` to the device (e.g., via
a Telegram message) opens the app to that exact catalog page.

**Implementation notes:**
- `mobile/lib/tab-registry.ts` — module-scope `Map<TabId, PiercWebViewHandle>`
  keeps the deep-link handler out of React Context. Each tab
  screen registers its WebView handle on mount via `useEffect` +
  `useRef`, deregisters on unmount.
- `tabForPath()` resolves `/catalog/...` → `"catalog"`,
  `/book/...` → `"book"`, `/account` → `"account"`, everything
  else → `"home"`.
- Root layout (`app/_layout.tsx`) listens for two cases:
  - **Cold start** (`Linking.getInitialURL()`) — app was
    launched from a deep link
  - **Warm** (`Linking.addEventListener("url", ...)`) — app was
    already running and the OS handed us a URL
  Both call the same `handleUrl()` which parses, picks the tab,
  navigates the router, and after a 50 ms tick (so the new tab's
  WebView ref is registered) calls
  `getTabWebView(tab)?.navigate(targetUrl)`.
- For `pierc://` scheme, `expo-linking`'s `parse()` puts the first
  path segment in `hostname` rather than `path` — the handler
  stitches them back together before passing to `tabForPath()`.
- For Universal Links / App Links (`https://piercing.studio/...`),
  full functionality requires the server to serve
  `/.well-known/apple-app-site-association` (iOS) and
  `/.well-known/assetlinks.json` (Android). Until those are added
  to the Next.js app's `public/` directory, only the custom
  `pierc://` scheme works. Both files are listed as user-side
  follow-ups in the README troubleshooting section.
- `mobile/README.md` (256 lines): dev workflow (Expo Go QR code),
  `EXPO_PUBLIC_APP_URL` for non-prod backends, deep-link CLI
  commands for both platforms, EAS Build instructions, full
  user-side checklist for Apple Developer + Google Play Console
  signup, branded assets, store listing requirements, and
  post-launch ops (keystore protection, certificate rotation).

## Risks & open questions

- **Live deploy URL must be HTTPS and stable.** The whole app
  loads from `APP_URL`. Domain changes mean a new app build.
- **iOS WebView 3D performance** — Three.js in WKWebView is well-
  benchmarked at 50-60fps for our scene complexity. If a specific
  device shows degradation, lite mode auto-fallback already covers
  it. WebGL2 capability check + lite mode landed in Phase 2 work
  stream 1; the mobile app gets that for free.
- **Apple / Google review risk** — first submission can be
  rejected for trivial things (privacy-policy link missing, demo
  account not provided, screenshots wrong size). Building enough
  buffer time into the first launch is the real defense.
- **Android keystore loss** — if the Android keystore the first
  build is signed with is lost, future updates can't be published
  under the same app id. EAS managed credentials avoids this; if
  going manual, back it up to a password manager.
- **Push notifications scope** — deferring to a follow-up because
  it requires server-side schema work (`DeviceToken` model) and
  notification dispatch in `lib/notifications/`. Not blocking the
  WebView shell.
- **"What if APP_URL is offline?"** — the app currently shows a
  blank WebView with a system error if the deploy is down. A
  future polish item: detect navigation failures via the WebView's
  `onError` callback and render a native error state with a retry
  button.
