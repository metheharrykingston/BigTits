#!/usr/bin/env bash
set -euo pipefail

# Build Android APK/AAB from a hosted PWA using Bubblewrap + Gradle/TWA.
# Usage:
#   ./build_android_twa.sh             # fast incremental debug APK
#   ./build_android_twa.sh --release   # signed release APK and AAB
#   ./build_android_twa.sh --clean     # clean, then build debug APK
#
PWA_URL="https://big-tits.vercel.app/"
MANIFEST_URL="${PWA_URL}manifest.webmanifest"
OUT_DIR="pwa-android-twa"
MODE="debug"
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --release) MODE="release" ;;
    --clean) CLEAN=true ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--release] [--clean]"
      exit 2
      ;;
  esac
done

command_exists() { command -v "$1" >/dev/null 2>&1; }

if ! command_exists node; then
  echo "Node.js is missing. Install Node 18+ first."
  exit 1
fi

if ! command_exists npm; then
  echo "npm is missing. Install npm first."
  exit 1
fi

if ! command_exists bubblewrap; then
  echo "Bubblewrap CLI is missing. Install it with: npm i -g @bubblewrap/cli"
  exit 1
fi

if ! command_exists java; then
  echo "Java/JDK is missing. Install JDK 17 or newer first."
  exit 1
fi

cd "$OUT_DIR"

if [[ ! -f app/build.gradle ]]; then
  echo "Android project is incomplete; regenerating it from twa-manifest.json..."
  bubblewrap update --skipVersionUpgrade
fi

if [[ "$CLEAN" == true ]]; then
  ./gradlew clean
fi

if [[ "$MODE" == "release" ]]; then
  if [[ ! -f android.keystore ]]; then
    echo "Release keystore is missing: $(pwd)/android.keystore"
    echo "TWA cannot make a trusted release without the same signing key used in assetlinks.json."
    echo "Either restore android.keystore or create a new release key and update public/.well-known/assetlinks.json with its SHA-256 fingerprint."
    exit 1
  fi

  echo "Building signed release APK and AAB..."
  bubblewrap build --skipPwaValidation
  echo "APK: $(pwd)/app-release-signed.apk"
  echo "AAB: $(pwd)/app-release-bundle.aab"
else
  echo "Building incremental debug APK..."
  ./gradlew :app:assembleDebug
  APK="$(pwd)/app/build/outputs/apk/debug/app-debug.apk"
  echo "APK: $APK"
  if command_exists adb && adb get-state >/dev/null 2>&1; then
    adb install -r "$APK"
  fi
fi
