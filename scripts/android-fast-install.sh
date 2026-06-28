#!/usr/bin/env bash
# Fast Android deploy without Android Studio Run/Sync (seconds vs minutes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android SDK platform-tools."
  exit 1
fi

DEVICE="${ANDROID_SERIAL:-$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')}"
if [[ -z "$DEVICE" ]]; then
  echo "No Android device/emulator connected."
  exit 1
fi

echo "Target device: $DEVICE"

cd "$ROOT"
npm run android:plugin
CAPACITOR_DEV=1 CAPACITOR_SERVER_URL=http://10.0.2.2:5173 npx cap copy android

cd "$ANDROID"
./gradlew installDebug --parallel --build-cache --configure-on-demand

# Let the soft keyboard stay available when typing from a physical keyboard (emulator host keys).
adb -s "$DEVICE" shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null 2>&1 || true

adb -s "$DEVICE" shell am start -n com.harrykingston.bigtits/.MainActivity
echo "Installed and launched. Keep Vite (:5173) + API (:3001) + Core (:8000) running on host."