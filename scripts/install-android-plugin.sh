#!/usr/bin/env bash
# Copy Portal Workspace native plugin into BigTits Capacitor Android project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
PLUGIN_SRC="$ROOT/native/portal-workspace"

if [[ ! -d "$ANDROID/app/src/main" ]]; then
  echo "Android project missing. Run: cd app && npm run build && npx cap add android"
  exit 1
fi

DEST_JAVA="$ANDROID/app/src/main/java/io/govcopilot/portalworkspace"
DEST_ASSETS="$ANDROID/app/src/main/assets"
LEGACY_JAVA="$ANDROID/app/src/main/java/in/govcopilot/portalworkspace"

# Kotlin treats `in` as a reserved keyword — remove stale copies from older installs.
if [[ -d "$LEGACY_JAVA" ]]; then
  rm -rf "$ANDROID/app/src/main/java/in"
  echo "Removed legacy in.govcopilot plugin sources (invalid Kotlin package)."
fi

mkdir -p "$DEST_JAVA" "$DEST_ASSETS/adapters"
cp -r "$PLUGIN_SRC/io/govcopilot/portalworkspace/"*.kt "$DEST_JAVA/"
cp "$PLUGIN_SRC/assets/autofill.js" "$DEST_ASSETS/"
cp -r "$PLUGIN_SRC/assets/adapters/"* "$DEST_ASSETS/adapters/"

MANIFEST="$ANDROID/app/src/main/AndroidManifest.xml"
if [[ -f "$MANIFEST" ]] && ! grep -q PortalWorkspaceActivity "$MANIFEST"; then
  sed -i 's|</application>|        <activity\n            android:name="io.govcopilot.portalworkspace.PortalWorkspaceActivity"\n            android:exported="false"\n            android:theme="@style/AppTheme.NoActionBarLaunch" />\n    </application>|' "$MANIFEST"
fi

MAIN_ACTIVITY=$(find "$ANDROID/app/src/main/java" -name 'MainActivity.kt' -o -name 'MainActivity.java' | head -n 1)
if [[ -n "$MAIN_ACTIVITY" ]] && ! grep -q PortalWorkspacePlugin "$MAIN_ACTIVITY"; then
  if [[ "$MAIN_ACTIVITY" == *.java ]]; then
    cat >"$MAIN_ACTIVITY" <<'JAVA'
package com.harrykingston.bigtits;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.govcopilot.portalworkspace.PortalWorkspacePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PortalWorkspacePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
JAVA
    echo "Registered PortalWorkspacePlugin in $MAIN_ACTIVITY"
  else
    echo "Register PortalWorkspacePlugin in $MAIN_ACTIVITY manually"
  fi
fi

echo "Portal Workspace plugin installed into app/android."