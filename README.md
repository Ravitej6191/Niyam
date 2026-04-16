# Niyam — Productivity App

Track habits, expenses, notes, and counts. Your daily productivity companion.

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Animations**: Motion (Framer Motion)
- **Mobile**: Capacitor v7 (wraps the web app as a native Android APK)
- **Storage**: localStorage (persisted via Capacitor's WebView)

---

## Running Locally (Web)

```bash
npm install
npm run dev
```

---

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
# 1. Install dependencies
npm install

# 2. Build the web app
npm run build

# 3. First time only: add Android platform
npx cap add android

# 4. Sync web build to Android
npx cap sync

# 5. Open in Android Studio to build APK
npx cap open android
# Inside Android Studio: Build > Build APK(s)
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Or via command line

```bash
cd android
./gradlew assembleDebug
```

### Install on phone

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the phone and open it (enable "Install unknown apps").

---

## After every code change

```bash
npm run build
npx cap sync
# Rebuild APK in Android Studio
```
