# Niyam — Productivity App

Track habits, expenses, notes, counters, focus time, mood, breathing and a daily journal,
with an XP/level system on top. Your daily productivity companion.

---

## Tech Stack

- **Frontend**: React 18 + TypeScript (strict) + Vite
- **Styling**: Tailwind CSS v4
- **Animations**: Motion (Framer Motion)
- **Mobile**: Capacitor v7 (wraps the web app as a native Android app)
- **Auth**: Google sign-in via Firebase Authentication (or Guest mode)
- **Storage**: Cloud Firestore for signed-in users (offline-aware, see below) plus a local
  copy in the WebView's localStorage; Guest mode is local only

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production web build into `build/` |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (sync merge, migration, XP, PIN/secret hashing) |
| `npm run check` | typecheck + lint + tests |

## Data & sync

Signed-in data lives in Firestore, split into `users/{uid}` (profile, settings, a `_rev`
counter) and `users/{uid}/parts/{collection}` for each large collection, so each collection
has its own 1 MiB document limit.

- Writes are transactional and compare `_rev`. If another device saved first, the app reloads,
  **merges by record id** (this device wins for the same record) and retries instead of
  overwriting. A deletion made on one device can be resurrected by a stale device — the trade-off
  for never silently dropping data.
- If the initial cloud load fails, the app works from the local copy and **does not write to the
  cloud** until a load succeeds (retries every 15 s and when the network returns), so empty or
  stale local data can never replace real cloud data.
- The user is warned when a collection nears the document size limit.

### Firestore security rules

Rules live in [`firestore.rules`](firestore.rules). Deploy them whenever they change:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

## Running Locally (Web)

```bash
npm install
npm run dev
```

## Building an APK

### Prerequisites

| Tool | Download |
|------|----------|
| Node.js 18+ | https://nodejs.org |
| Android Studio | https://developer.android.com/studio |
| Java 17 JDK | Bundled with Android Studio |

Set `ANDROID_HOME` env variable after installing Android Studio.

### Steps

```bash
npm install
npm run build
npx cap sync          # copy the web build + plugins into android/
npx cap open android  # then Build > Build APK(s) in Android Studio
```

Or from the command line:

```bash
cd android
./gradlew assembleDebug     # APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a phone with `adb install <apk>`, or copy it over and open it (enable
"Install unknown apps").

### Release build

Release builds are minified/shrunk (R8) and signed with your own key. Create
`android/keystore.properties` (git-ignored — never commit it or the `.jks`):

```properties
storeFile=../niyam-release.jks
storePassword=...
keyAlias=...
keyPassword=...
```

then `cd android && ./gradlew bundleRelease` (Play Store) or `assembleRelease`.
Test a release build on a device: R8 keep rules for Capacitor are in
`android/app/proguard-rules.pro`.

Google Play restricts the `SCHEDULE_EXACT_ALARM` permission (used so reminders fire on time);
declare the reminder use case in Play Console → App content.

### After every code change

```bash
npm run build && npx cap sync
```

## Security notes

- The app PIN and note passwords are stored as salted PBKDF2-SHA256 hashes; PIN failures
  lock out with an increasing delay that survives restarts. It is an app-level lock — it deters
  casual access but is not protection against someone with root access to the device storage.
  Note text is not encrypted at rest.
- Android auto-backup is disabled so local data isn't copied off the device by `adb backup`.
- See [PRIVACY.md](PRIVACY.md) for what leaves the device (weather lookup, Firebase).
