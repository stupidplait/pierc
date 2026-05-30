# Pierc Studio — Mobile App

The native iOS + Android wrapper around the live web app. This is a
**WebView shell**: native bottom-tab nav, deep linking, share, and
back-button handling on the outside; the production Next.js app
(`https://piercing.studio`) renders inside a `WKWebView` (iOS) /
System WebView (Android).

See [`../docs/19-mobile-app.md`](../docs/19-mobile-app.md) for the
full design rationale.

## Project layout

```
mobile/
├── app/                 ← expo-router routes
│   ├── _layout.tsx      ← root: splash, deep-link handler, Stack
│   ├── (tabs)/
│   │   ├── _layout.tsx  ← bottom tab nav
│   │   ├── index.tsx    ← Главная
│   │   ├── catalog.tsx  ← Каталог
│   │   ├── book.tsx     ← Запись
│   │   └── account.tsx  ← Профиль
│   └── +not-found.tsx
├── components/
│   └── PiercWebView.tsx ← WebView wrapper: back btn, share, external links
├── constants/
│   └── config.ts        ← APP_URL + tab table
├── lib/
│   └── tab-registry.ts  ← deep-link → WebView ref bridge
├── assets/
│   ├── icon.png         ← 1024×1024 placeholder (swap for branded asset)
│   └── splash.png       ← 1284×2778 placeholder
├── app.json             ← Expo config (deep linking, plist permissions)
├── eas.json             ← EAS Build / submit config
└── package.json
```

## Dev workflow (Expo Go on your phone)

This is the fastest way to see the app running:

```bash
cd mobile
npm install
npx expo start
```

Metro starts and prints a QR code. Install **Expo Go** from the App
Store / Play Store, scan the QR with your phone (iOS Camera app or
Expo Go's built-in scanner on Android). The app loads on your phone
with hot reload — every save in this folder reloads the app live.

### Pointing at a non-prod backend

By default the WebView loads `https://piercing.studio`. To point it
at a local Next.js dev server or a Vercel preview URL, create
`mobile/.env.local`:

```
EXPO_PUBLIC_APP_URL=https://your-preview-deploy.vercel.app
```

Or for fully local testing (your laptop running `npm run dev`):

```
EXPO_PUBLIC_APP_URL=http://192.168.1.42:3000
```

Use your laptop's LAN IP (not `localhost`) so the phone can reach
it. Only HTTPS production URLs work for the App Store builds —
HTTP is fine in dev only.

### Testing deep links

With the app running on Expo Go, send a `pierc://` URL to your phone
(via Telegram, email, whatever). Tapping it opens the app to that
exact tab + WebView page.

iOS Simulator command-line test:
```bash
xcrun simctl openurl booted "pierc://catalog/some-jewelry-id"
```

Android emulator:
```bash
adb shell am start -a android.intent.action.VIEW -d "pierc://catalog/some-jewelry-id"
```

## Native test builds (closer to App Store reality)

Once Expo Go testing isn't enough — e.g., you need to test the real
app icon, splash, plist permissions, or Android intent filters —
use EAS Build:

```bash
npm install -g eas-cli
eas login                         # one-time, prompts for Expo creds
eas build --profile preview --platform ios     # produces an .ipa
eas build --profile preview --platform android # produces an .apk
```

The `preview` profile in [`eas.json`](./eas.json) builds for
**internal distribution**: an `.ipa` you can install on registered
test devices, an `.apk` you can sideload. No App Store / Play Store
submission yet.

EAS Build's free tier is generous; paid tiers ($19–$99/mo) buy
higher build concurrency and priority. See
[expo.dev/pricing](https://expo.dev/pricing).

## Production builds + store submission

These steps are **user-side** — they require accounts and decisions
only the studio owner can make. Treat this as a checklist.

### 1. Apple Developer Program ($99/year)

1. Sign up at [developer.apple.com](https://developer.apple.com/programs/).
   Individual or Organization. Approval ~24-48 hours.
2. In **App Store Connect**, create a new app:
   - Bundle ID: `studio.pierc.app` (matches `app.json`)
   - SKU: `pierc-mobile-001`
   - Primary language: Russian
3. Generate App-Specific Password if uploading via `altool` instead
   of EAS Submit (EAS handles the auth automatically once logged in
   via `eas login`).
4. Update `eas.json` `submit.production.ios` with:
   - `ascAppId`: the App Store Connect **App ID** (numeric, found
     under App Information in ASC)
   - `appleTeamId`: your **Team ID** from
     [developer.apple.com/account](https://developer.apple.com/account)

### 2. Google Play Console ($25 one-time)

1. Sign up at [play.google.com/console](https://play.google.com/console).
   Approval ~24-48 hours.
2. Create a new app:
   - Package name: `studio.pierc.app` (matches `app.json`)
   - Default language: Russian
3. Generate a service account for EAS Submit:
   - Play Console → Setup → API access → Create new service account
   - Grant "Release manager" role
   - Download the JSON key, save as `mobile/play-store-key.json`
   - **Add `mobile/play-store-key.json` to .gitignore** if not
     already (the root `.gitignore` ignores `mobile/.env*` but the
     key is its own file — rename to `*.env.json` or add an explicit
     ignore).
4. Update `eas.json` `submit.production.android` is already wired
   for `./play-store-key.json`.

### 3. Branded assets (replace placeholders)

Both `mobile/assets/icon.png` (1024×1024) and `mobile/assets/splash.png`
(1284×2778) are placeholder brand-pink "P" graphics. Replace with
the studio's actual branded assets before submission.

For the App Store you'll also need:
- **App icon** at 1024×1024 (no transparency)
- **Screenshots** for iPhone 6.7" + iPhone 6.5" + iPad 12.9" (if
  supporting iPad — currently `supportsTablet: false`, so only the
  iPhone sizes)
- **App description** in Russian (max 4000 chars)
- **Keywords** (max 100 chars, comma-separated)
- **Support URL** (a page on piercing.studio explaining how to
  contact you)
- **Marketing URL** (optional — usually piercing.studio root)
- **Privacy policy URL** (required; needs a `/privacy-policy` page
  on the live site explaining what data is collected and how)

For the Play Store:
- **App icon** 512×512
- **Feature graphic** 1024×500
- **Screenshots** at least 2, recommend 4-8
- **Short description** (≤80 chars)
- **Full description** (≤4000 chars)
- **Privacy policy URL** (required, same as App Store)
- **Data safety** declaration in Play Console (the WebView accesses
  the camera/photos for selfie upload; declare those)

### 4. Build + submit

```bash
# Production build, both platforms
eas build --profile production --platform all

# After build completes:
eas submit --profile production --platform ios       # to App Store
eas submit --profile production --platform android   # to Play Store
```

First iOS review takes ~1-2 weeks. First Android review ~24-48 hours
(Play Store auto-flags fewer issues than Apple). Subsequent updates
review in ~24 hours each.

### 5. Post-launch

- **Keep the Android keystore safe.** Lose it and you can't update
  the app under the same package name forever. Back up to a password
  manager. EAS managed credentials handles this for you if you
  haven't customised — `eas credentials` shows what's stored.
- **iOS code-signing certificates** rotate every year. EAS prompts
  to renew during the next build.
- **Updates are submitted same way** as the first build — bump
  version in `app.json`, run `eas build`, run `eas submit`.

## What's deferred (not built yet)

These were intentionally scoped out of v1 — see
[`../docs/19-mobile-app.md`](../docs/19-mobile-app.md):

- **Push notifications** — Expo Notifications scaffolding, device
  token registration, server-side dispatch from booking emails.
  Requires schema work (`DeviceToken` model) and lands as a
  follow-up task.
- **Native screens** for catalog grid, jewelry detail, booking flow.
  Each page in the WebView already works; native re-implementation
  is the worst-of-both-worlds path.
- **Offline mode** — Service Worker on the web side could light
  this up later.
- **Biometric auth** for `/account`.

## Troubleshooting

### `npx expo start` hangs on "Starting Metro Bundler"

Delete `mobile/node_modules` and `mobile/.expo`, run `npm install`
again. Metro caches aggressively; a fresh install fixes most weird
bundler issues.

### WebView shows a blank screen on first launch

The dev server might not have finished its first build. Pull-to-
refresh on the WebView, or restart Metro.

### iOS deep links open Safari instead of the app

Universal Links (`https://piercing.studio/...`) require an
[`apple-app-site-association`](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
file served at `https://piercing.studio/.well-known/apple-app-site-association`.
The web Next.js app needs to serve this static JSON file. Until
that's deployed, Universal Links fall back to the browser. Custom
scheme links (`pierc://...`) work without it.

### Android deep links don't open the app

Run `adb shell pm get-app-links studio.pierc.app` to check verification
status. Auto-verification needs the same `digital-asset-links` JSON
served at `https://piercing.studio/.well-known/assetlinks.json`.
Same story as iOS — until the server-side asset is deployed, only
the custom scheme works.

### `EXPO_PUBLIC_APP_URL` change doesn't take effect

Expo inlines `EXPO_PUBLIC_*` env vars at bundle time. After changing
`mobile/.env.local`, restart Metro (`Ctrl+C`, `npx expo start`).
