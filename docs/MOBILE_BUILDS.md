# Getting Sufara onto a phone

Three ways, cheapest first. **None of them can be done from the Claude Code
container** this project was built in: it has no Android SDK, and the network
policy blocks both `dl.google.com` (Android SDK and Gradle plugin artifacts) and
`api.expo.dev` (EAS cloud builds). So an APK has to be produced from your machine
or from Expo's cloud, with your account.

---

## The prerequisite everyone forgets

**A standalone build needs a reachable API.** `EXPO_PUBLIC_API_URL` is baked into
the bundle at build time — it is not read at runtime. If it is unset, the build
points at `localhost:4000`, which on a phone means the phone itself, where
nothing is listening. The app then looks broken rather than misconfigured.

The app now defends against this in two ways: it logs a loud warning on startup
in a release build with no configured URL, and the home screen names the endpoint
it failed to reach.

So: **deploy the API first** ([`DEPLOYMENT.md`](DEPLOYMENT.md)), then set
`EXPO_PUBLIC_API_URL` in [`mobile/eas.json`](../mobile/eas.json) to your Render
URL, then build.

---

## Option 1 — Expo Go (no build at all, ~2 minutes)

Best for looking at it on your phone today.

```bash
# terminal 1
npm run api

# terminal 2
npm run mobile          # then scan the QR code with Expo Go
```

Install **Expo Go** from the Play Store / App Store first. Your phone and
computer must be on the same network; the app finds the API automatically on port
4000 of the Metro host, so there is nothing to configure.

Limitation: Expo Go cannot load custom native code. Everything in this MVP works,
but the real map on Android needs a Google Maps API key configured in a custom
build (option 2 or 3) — in Expo Go the map may render empty on Android.

## Option 2 — EAS cloud build → installable APK (~15 minutes, no Android SDK)

Expo builds it on their infrastructure. Free tier is enough for this.

```bash
npm install -g eas-cli
cd mobile
eas login                      # create a free account at expo.dev if needed
eas init                       # links the project, writes extra.eas.projectId

# point the preview profile at your deployed API first!
#   mobile/eas.json → build.preview.env.EXPO_PUBLIC_API_URL

npm run build:apk              # eas build --platform android --profile preview
```

EAS prints a download URL when it finishes. Open it on the phone, allow
"install from unknown sources", done. The `preview` profile is configured with
`buildType: apk` precisely so you get a directly installable file rather than a
Play Store `.aab`.

For the Play Store instead: `npm run build:android` (produces an `.aab`).
For iOS: `npm run build:ios` (needs an Apple Developer account, $99/year).

## Option 3 — Build locally (needs Android SDK, no Expo account)

```bash
cd mobile
npx expo prebuild --platform android      # generates the native project
cd android
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

Requires JDK 17, the Android SDK with build-tools, and `ANDROID_HOME` set.
Remember to export `EXPO_PUBLIC_API_URL` before `prebuild`, or pass it in the
Gradle environment.

`eas build --profile preview --local` (also wired up as `npm run build:apk:local`)
does the same thing through EAS tooling while still building on your machine.

---

## Before you ship it to anyone else

- **Signing.** EAS generates and stores an upload keystore for you on the first
  Android build. Keep it — losing it means you cannot update the app on the Play
  Store. `eas credentials` shows what is stored.
- **Google Maps on Android.** Android needs a Maps SDK key or the map renders
  blank; iOS uses Apple Maps and needs none. The key is read from the
  environment in [`mobile/app.config.ts`](../mobile/app.config.ts) — never
  committed — and injected into the native manifest at prebuild time:

  ```bash
  # local build
  export GOOGLE_MAPS_ANDROID_API_KEY=<key>

  # EAS build
  eas secret:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key>
  ```

  Get it from Google Cloud Console → **Maps SDK for Android**, and restrict it to
  the package name `app.sufara.mobile` plus your signing certificate's SHA-1
  (`eas credentials` shows the fingerprint). Without the variable set, the build
  still succeeds and injects nothing — the map is simply blank.
- **Seeded accounts.** The seed prints a generated admin password once, or takes
  one from `SEED_PASSWORD`. Nothing is published in this repository, and the login
  screen no longer prefills credentials — a prefilled password would ship inside
  the app bundle.
- **Version numbers.** The `production` profile sets `autoIncrement: true`, so
  `versionCode` advances per build. Bump `version` in `app.config.ts` for
  user-visible releases.

## What each profile is for

| Profile | Output | `EXPO_PUBLIC_API_URL` should be |
| --- | --- | --- |
| `development` | dev client, internal | your computer's LAN IP, e.g. `http://192.168.1.10:4000/api/v1` |
| `preview` | **APK**, internal | your deployed Render URL |
| `production` | AAB for Play Store | your deployed Render URL |

The `development` profile additionally needs `npx expo install expo-dev-client`.
